import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import PDFParser from "pdf2json";

// Extract PDF text using pdf2json
async function extractPDFText(
  filePath: string
): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("PDF Parser Error:", errData.parserError);
      reject(new Error(errData.parserError || "PDF parsing failed"));
    });

    pdfParser.on("pdfParser_dataReady", () => {
      try {
        const rawText = (pdfParser as any).getRawTextContent();
        const pdfData = (pdfParser as any).getRawTextContent();

        // Get page count from the parser
        const pageCount = pdfParser.Pages?.length || 1;

        resolve({
          text: rawText || "",
          pageCount: pageCount,
        });
      } catch (error: any) {
        reject(new Error(`Failed to extract text: ${error.message}`));
      }
    });

    // Load the PDF file
    pdfParser.loadPDF(filePath);
  });
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

    console.log("Extracting PDF text using pdf2json...");

    // Extract text using pdf2json
    const { text, pageCount } = await extractPDFText(tempFilePath);

    console.log(
      `Extraction complete: ${text.length} characters from ${pageCount} pages`
    );

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
