// app/api/database/[dbType]/connect/route.ts
import { NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dbType: string }> }
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { connectionString } = body || {};
    const { dbType } = await params;

    if (!connectionString) {
      return NextResponse.json(
        { error: "Connection string is required" },
        { status: 400 }
      );
    }

    let sourceName = "";

    switch (dbType) {
      case "postgres":
        sourceName = "PostgreSQL Database";
        return NextResponse.json(
          {
            error:
              "PostgreSQL connection not implemented. Please configure in your API route.",
            hint: "Install 'pg' package and implement connection logic in app/api/database/[dbType]/connect/route.ts",
          },
          { status: 501 }
        );

      case "mysql":
        sourceName = "MySQL Database";
        return NextResponse.json(
          {
            error:
              "MySQL connection not implemented. Please configure in your API route.",
            hint: "Install 'mysql2' package and implement connection logic",
          },
          { status: 501 }
        );

      case "sqlite":
        sourceName = "SQLite Database";
        return NextResponse.json(
          {
            error:
              "SQLite connection not implemented. Please configure in your API route.",
            hint: "Install 'better-sqlite3' package and implement connection logic",
          },
          { status: 501 }
        );

      case "mongodb": {
        sourceName = "MongoDB Database";
        // ✅ Ensure the correct export name is used
        const { connectToMongoDB } = await import("@/lib/mongodb");

        // ✅ Connect to MongoDB
        const { db } = await connectToMongoDB(connectionString);

        // ✅ Fetch sample documents
        const collections = await db.listCollections().toArray();
        const rows: any[] = [];

        for (const col of collections.slice(0, 3)) {
          const collection = db.collection(col.name);
          const docs = await collection.find({}).limit(5).toArray();
          rows.push({ collection: col.name, data: docs });
        }

        // ✅ Process and return dataset
        const dataset = DataProcessor.createDataSet(
          rows,
          "mongodb" as any, // casting for now until DataProcessor type is updated
          sourceName
        );
        return NextResponse.json({ dataset });
      }

      default:
        return NextResponse.json(
          { error: `Unsupported database type: ${dbType}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    const { dbType } = await params;
    console.error(`Error in ${dbType} connect API:`, error);
    return NextResponse.json(
      { error: error?.message || "Database connection failed" },
      { status: 500 }
    );
  }
}
