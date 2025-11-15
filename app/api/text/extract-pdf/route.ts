// @ts-nocheck - Buffer type compatibility issues with strict TypeScript
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { unlink } from "fs/promises";
import { createReadStream, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult,
  SDKError,
  ServiceUsageError,
  ServiceApiError,
} from "@adobe/pdfservices-node-sdk";

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  let zipFilePath: string | null = null;
  let readStream: Readable | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Check for Adobe PDF Services credentials
    if (
      !process.env.PDF_SERVICES_CLIENT_ID ||
      !process.env.PDF_SERVICES_CLIENT_SECRET
    ) {
      return NextResponse.json(
        {
          error: "Adobe PDF Services credentials not configured",
          details:
            "PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET must be set in environment variables",
        },
        { status: 500 }
      );
    }

    // Convert File to buffer and save temporarily
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create temporary file for Adobe PDF Services
    tempFilePath = join(
      tmpdir(),
      `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeFileSync(tempFilePath, buffer as any);

    // Create read stream from temporary file
    readStream = createReadStream(tempFilePath) as any;

    // Initial setup, create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.PDF_SERVICES_CLIENT_ID,
      clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET,
    });

    // Creates a PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Creates an asset from source file and upload
    if (!readStream) {
      throw new Error("Failed to create read stream");
    }
    const inputAsset = await pdfServices.upload({
      readStream: readStream as any,
      mimeType: MimeType.PDF,
    });

    // Create parameters for the job
    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT],
    });

    // Creates a new job instance
    const job = new ExtractPDFJob({ inputAsset, params });

    // Submit the job and get the job result
    const pollingURL = await pdfServices.submit({ job });
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExtractPDFResult,
    });

    // Get content from the resulting asset
    if (!pdfServicesResponse.result?.resource) {
      throw new Error("PDF extraction result is null");
    }
    const resultAsset = pdfServicesResponse.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Save the ZIP file temporarily
    zipFilePath = join(
      tmpdir(),
      `extract-${Date.now()}-${Math.random().toString(36).substring(7)}.zip`
    );

    // Write the stream to file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunks: any[] = [];
    for await (const chunk of streamAsset.readStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zipBuffer = Buffer.concat(chunks);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeFileSync(zipFilePath, zipBuffer as any);

    // Extract and parse the ZIP file
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    // Find the JSON file in the ZIP (usually named structuredData.json or similar)
    let extractedText = "";
    let pageCount = 0;

    for (const entry of zipEntries) {
      if (entry.entryName.endsWith(".json")) {
        const jsonContent = entry.getData().toString("utf8");
        const jsonData = JSON.parse(jsonContent);

        // Extract text from Adobe's JSON structure
        // Adobe PDF Services returns structured data with elements array
        if (jsonData.elements && Array.isArray(jsonData.elements)) {
          const textElements: string[] = [];
          const pages = new Set<number>();

          // Recursive function to extract text from nested elements
          const extractTextFromElement = (element: any) => {
            // Check for direct text property
            if (element.Text && typeof element.Text === "string") {
              textElements.push(element.Text);
            }

            // Check for text in path (for structured text)
            if (element.path && Array.isArray(element.path)) {
              for (const pathItem of element.path) {
                if (pathItem.Text && typeof pathItem.Text === "string") {
                  textElements.push(pathItem.Text);
                }
              }
            }

            // Check for Page number
            if (
              element.Page !== undefined &&
              typeof element.Page === "number"
            ) {
              pages.add(element.Page);
            }

            // Recursively process nested elements
            if (element.elements && Array.isArray(element.elements)) {
              for (const nestedElement of element.elements) {
                extractTextFromElement(nestedElement);
              }
            }
          };

          // Process all elements
          for (const element of jsonData.elements) {
            extractTextFromElement(element);
          }

          extractedText = textElements.join("\n\n");
          pageCount = pages.size || (jsonData.elements.length > 0 ? 1 : 0);
        } else if (typeof jsonData === "string") {
          // If the JSON is just a string
          extractedText = jsonData;
          pageCount = 1;
        } else {
          // Fallback: try to extract any text-like properties
          const jsonString = JSON.stringify(jsonData);
          if (jsonString.length > 0) {
            extractedText = jsonString;
            pageCount = 1;
          }
        }
        break;
      }
    }

    // Clean up temporary files
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {
        // Ignore cleanup errors
      });
    }
    if (zipFilePath) {
      await unlink(zipFilePath).catch(() => {
        // Ignore cleanup errors
      });
    }
    if (readStream) {
      readStream.destroy();
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: "No readable text found in the PDF file." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text: extractedText,
      pageCount: pageCount || 1,
    });
  } catch (error: any) {
    // Clean up temporary files on error
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {
        // Ignore cleanup errors
      });
    }
    if (zipFilePath) {
      await unlink(zipFilePath).catch(() => {
        // Ignore cleanup errors
      });
    }
    if (readStream) {
      readStream.destroy();
    }

    if (
      error instanceof SDKError ||
      error instanceof ServiceUsageError ||
      error instanceof ServiceApiError
    ) {
      console.error("Adobe PDF Services error:", error);
      return NextResponse.json(
        {
          error: "Adobe PDF Services error",
          details: error.message,
        },
        { status: 500 }
      );
    }

    console.error("PDF extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract PDF content",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
