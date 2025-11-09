// app/api/text/extract-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create temporary file
    tempFilePath = join(tmpdir(), `pdf_${Date.now()}_${file.name}`);
    await writeFile(tempFilePath, new Uint8Array(buffer));

    // Load PDF using LangChain
    const loader = new PDFLoader(tempFilePath, {
      splitPages: false, // Get all text as one document
    });

    const docs = await loader.load();

    // Extract text from all pages
    const text = docs.map((doc) => doc.pageContent).join("\n\n");

    // Extract metadata
    const metadata = {
      pageCount: docs.length,
      fileName: file.name,
      fileSize: file.size,
    };

    return NextResponse.json({
      text,
      metadata,
    });
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract PDF content",
        details: error.message,
      },
      { status: 500 }
    );
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }
  }
}
