import { NextRequest, NextResponse } from "next/server";
import { promises as fs, unlink } from "fs";
import { v4 as uuidv4 } from "uuid";
import PDFParser from "pdf2json";
import { resolve } from "path";
import { tmpdir } from "os";

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    let fileName = "";
    let parsedText = "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    console.log("Received PDF file:", file.name, file.size);
    fileName = uuidv4();
    console.log("Generated temp file name:", fileName);

    // tempFilePath = join(tmpdir(), `${fileName}.pdf`);
    tempFilePath = resolve(tmpdir(), `${fileName}.pdf`);
    console.log("Temporary file path:", tempFilePath);
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    console.log("Writing file to temp path:", tempFilePath);

    await fs.writeFile(tempFilePath, fileBuffer);
    const pdfParser = new (PDFParser as any)(null, 1);
    console.log("Initialized PDFParser");

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("PDF parsing error:", errData.parserError);
    });
    console.log("Set up PDFParser event listeners");

    pdfParser.on("pdfParser_dataReady", () => {
      console.log((pdfParser as any).getRawTextContent());
      parsedText = (pdfParser as any).getRawTextContent();
    });
    console.log("Loading PDF file into parser:", tempFilePath);

    await new Promise((resolve, reject) => {
      pdfParser.loadPDF(tempFilePath);
      pdfParser.on("pdfParser_dataReady", resolve);
      pdfParser.on("pdfParser_dataError", reject);
    });
    console.log("PDF parsing completed");

    console.log("Parsed text length:", parsedText.length);
    console.log("Parsed text preview:", parsedText.slice(0, 200)); // Log first 200 characters
    const metadata = {
      pageCount: parsedText.length,
      fileName: file.name,
      fileSize: file.size,
    };

    return NextResponse.json({
      parsedText,
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
  }
}
