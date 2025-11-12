// app/api/database/[dbType]/connect/route.ts
import { NextResponse } from "next/server";
import { mongoToDataset } from "@/lib/mongoToDataset";

export async function POST(
  request: Request,
  context: { params: { dbType: string } }
) {
  try {
    const body = await request.json();
    const { connectionString } = body || {};
    const { dbType } = context.params;

    if (!connectionString) {
      return NextResponse.json(
        { error: "Connection string is required" },
        { status: 400 }
      );
    }

    // Placeholder: implement actual DB connections here
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

        try {
          const { MongoClient } = await import("mongodb");
          const client = new MongoClient(connectionString);
          await client.connect();

          const adminDb = client.db().admin();
          const dbList = await adminDb.listDatabases();

          const allDocs: any[] = [];
          let totalCollections = 0;

          for (const dbInfo of dbList.databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();

            for (const colInfo of collections) {
              const col = db.collection(colInfo.name);
              const docs = await col.find({}).limit(200).toArray();

              if (docs.length > 0) {
                allDocs.push(...docs);
                totalCollections++;
              }
            }
          }

          if (allDocs.length === 0) {
            return NextResponse.json(
              { error: "No data found across all databases" },
              { status: 400 }
            );
          }

          const dataset = mongoToDataset(allDocs);
          return NextResponse.json({
            dataset,
            totalCollections,
            totalDocs: allDocs.length,
          });
        } catch (err: any) {
          console.error("MONGODB CONNECT ERROR:", err);
          return NextResponse.json(
            { error: err.message || "Failed to connect to MongoDB" },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: `Unsupported database type: ${dbType}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error(`Error in database connect API:`, error);
    return NextResponse.json(
      { error: error?.message || "Database connection failed" },
      { status: 500 }
    );
  }
}
