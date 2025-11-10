import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";

async function extractPDFText(
  filePath: string
): Promise<{ text: string; pageCount: number }> {
  let readStream;
  let extractedZipPath: string | null = null;

  try {
    const {
      ServicePrincipalCredentials,
      PDFServices,
      MimeType,
      ExtractPDFParams,
      ExtractElementType,
      ExtractPDFJob,
      ExtractPDFResult,
    } = require("@adobe/pdfservices-node-sdk");

    // Check for required credentials
    if (
      !process.env.PDF_SERVICES_CLIENT_ID ||
      !process.env.PDF_SERVICES_CLIENT_SECRET
    ) {
      throw new Error(
        "Adobe PDF Services credentials not found in environment variables"
      );
    }

    // Initial setup, create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: process.env.PDF_SERVICES_CLIENT_ID,
      clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET,
    });

    // Creates a PDF Services instance
    const pdfServices = new PDFServices({ credentials });

    // Creates an asset from source file and upload
    readStream = createReadStream(filePath);
    const inputAsset = await pdfServices.upload({
      readStream,
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

    // Get content from the resulting asset(s)
    const resultAsset = pdfServicesResponse.result.resource;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    // Save the ZIP file temporarily
    extractedZipPath = join(tmpdir(), `extract_${Date.now()}.zip`);
    const writeStream = createWriteStream(extractedZipPath);

    await pipeline(streamAsset.readStream, writeStream);

    // Extract and parse the JSON from the ZIP using unzipper
    const directory = await unzipper.Open.file(extractedZipPath);

    let structuredDataFile = null;
    for (const file of directory.files) {
      if (file.path === "structuredData.json") {
        structuredDataFile = file;
        break;
      }
    }

    if (!structuredDataFile) {
      throw new Error("structuredData.json not found in extracted ZIP");
    }

    const jsonBuffer = await structuredDataFile.buffer();
    const jsonContent = jsonBuffer.toString("utf8");
    const structuredData = JSON.parse(jsonContent);

    // Extract text from structured data
    const textParts: string[] = [];
    let pageCount = 0;

    if (structuredData.elements) {
      structuredData.elements.forEach((element: any) => {
        if (element.Text) {
          textParts.push(element.Text);
        }
        // Track pages
        if (element.Page !== undefined && element.Page > pageCount) {
          pageCount = element.Page;
        }
      });
    }

    const fullText = textParts.join(" ").replace(/\s+/g, " ").trim();

    return {
      text: fullText,
      pageCount: pageCount || 1,
    };
  } catch (error) {
    console.error("Adobe PDF Services extraction failed:", error);
    throw error;
  } finally {
    // Cleanup
    if (readStream) {
      readStream.destroy();
    }
    if (extractedZipPath && existsSync(extractedZipPath)) {
      try {
        await unlink(extractedZipPath);
      } catch (err) {
        console.error("Failed to delete extracted ZIP:", err);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    console.log(`Processing PDF: ${file.name} (${file.size} bytes)`);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure temp directory exists
    const tempDir = tmpdir();
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Create temporary file with safe naming
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    tempFilePath = join(tempDir, `pdf_${Date.now()}_${safeFileName}`);

    console.log("Writing PDF to temp file:", tempFilePath);
    await writeFile(tempFilePath, new Uint8Array(buffer));

    // Verify file was written
    if (!existsSync(tempFilePath)) {
      throw new Error("Failed to write temporary file");
    }

    console.log("Extracting PDF text using Adobe PDF Services...");

    // Extract text using Adobe PDF Services
    const { text, pageCount } = await extractPDFText(tempFilePath);

    console.log(
      `Extraction complete: ${text.length} characters from ${pageCount} pages`
    );

    console.log("Extracted text preview:", text.slice(0, 200));

    if (!text || text.trim().length === 0) {
      console.warn("PDF appears to be empty or contains only images");
      return NextResponse.json({
        text: "",
        metadata: {
          pageCount,
          fileName: file.name,
          fileSize: file.size,
          warning:
            "PDF appears to be empty or contains only images/scanned content",
        },
      });
    }

    console.log(
      `Successfully extracted ${text.length} characters from ${pageCount} pages`
    );

    // Extract metadata
    const metadata = {
      pageCount,
      fileName: file.name,
      fileSize: file.size,
    };

    return NextResponse.json({
      text,
      metadata,
    });
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    console.error("Error stack:", error.stack);

    return NextResponse.json(
      {
        error: "Failed to extract PDF content",
        details: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        if (existsSync(tempFilePath)) {
          await unlink(tempFilePath);
          console.log("Cleaned up temp file:", tempFilePath);
        }
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }
  }
}

// Configure route
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
