import { NextRequest, NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Invalid URL provided" },
        { status: 400 }
      );
    }

    // Extract spreadsheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid Google Sheets URL format" },
        { status: 400 }
      );
    }

    const spreadsheetId = match[1];

    // Extract GID if present (for specific sheet)
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    // Construct CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    // Fetch the CSV data
    const response = await fetch(csvUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Google Sheet not found or not publicly accessible" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch Google Sheet data" },
        { status: response.status }
      );
    }

    const csvText = await response.text();

    // Parse CSV
    const parseResult = await new Promise<Papa.ParseResult<any>>(
      (resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          complete: resolve,
          error: reject,
        });
      }
    );

    if (parseResult.errors.length > 0) {
      console.warn("CSV parsing warnings:", parseResult.errors);
    }

    if (!parseResult.data || parseResult.data.length === 0) {
      return NextResponse.json(
        { error: "No data found in Google Sheet" },
        { status: 400 }
      );
    }

    // Create typed dataset
    const dataset = DataProcessor.createDataSet(
      parseResult.data,
      "sheets",
      `Google Sheet (ID: ${spreadsheetId})`
    );

    if (dataset.rows.length === 0) {
      return NextResponse.json(
        { error: "No valid data rows found after processing" },
        { status: 400 }
      );
    }

    return NextResponse.json(dataset);
  } catch (error: any) {
    console.error("Error in sheets/load API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
