// app/api/database/[dbType]/connect/route.ts
import { NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";
import { mongoToDataset } from "@/lib/mongoToDataset";

export async function POST(
  request: Request,
  { params }: { params: { dbType: string } }
) {
  try {
    const body = await request.json();
    const { connectionString } = body || {};
    const { dbType } = params;

    if (!connectionString) {
      return NextResponse.json(
        { error: "Connection string is required" },
        { status: 400 }
      );
    }

    // Placeholder: implement actual DB connections here
    let rows: any[] = [];
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
        try {
          const { MongoClient } = await import("mongodb");
          const client = new MongoClient(connectionString);

          await client.connect();

          const dbName = connectionString.split("/").pop()?.split("?")[0];
          if (!dbName) {
            throw new Error("Failed to determine database name from URI.");
          }

          const db = client.db(dbName);

          const collections = await db.listCollections().toArray();
          if (collections.length === 0) {
            return NextResponse.json(
              { error: "No collections found in this MongoDB database" },
              { status: 400 }
            );
          }

          let selectedCollection = null;
          for (const c of collections) {
            const col = db.collection(c.name);
            const count = await col.estimatedDocumentCount();
            if (count > 0) {
              selectedCollection = col;
              break;
            }
          }

          if (!selectedCollection) {
            return NextResponse.json(
              { error: "All collections in this database are empty" },
              { status: 400 }
            );
          }

          const docs = await selectedCollection.find({}).limit(200).toArray();

          const dataset = mongoToDataset(docs);

          return NextResponse.json({
            success: true,
            dataset,
            collection: selectedCollection.collectionName,
          });
        } catch (err: any) {
          console.error("MONGODB CONNECT ERROR:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to connect to MongoDB" },
            { status: 500 }
          );
        }
      }
      default:
        return NextResponse.json(
          { error: "Unsupported database type" },
          { status: 400 }
        );
    }

    // If you implement DB calls above, use DataProcessor.createDataSet here:
    // if (rows.length === 0) { ... }
    // const dataset = DataProcessor.createDataSet(rows, dbType as any, sourceName);
    // return NextResponse.json({ dataset });
  } catch (error: any) {
    const { dbType } = params;
    console.error(`Error in ${dbType} connect API:`, error);
    return NextResponse.json(
      { error: error?.message || "Database connection failed" },
      { status: 500 }
    );
  }
}
