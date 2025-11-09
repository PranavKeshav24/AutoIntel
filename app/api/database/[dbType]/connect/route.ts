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
        const { MongoClient } = await import("mongodb");
        
        // Create a new connection for this request
        const client = new MongoClient(connectionString, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
        
        let clientConnected = false;
        
        try {
          // Connect to MongoDB
          await client.connect();
          clientConnected = true;
          const db = client.db();

          // ✅ Fetch sample documents
          const collections = await db.listCollections().toArray();

          if (collections.length === 0) {
            // Return empty dataset if no collections
            const emptyDataset = DataProcessor.createDataSet(
              [],
              "mongodb",
              sourceName
            );
            return NextResponse.json({ dataset: emptyDataset });
          }

          // Flatten all documents from collections into a single array
          const allRows: any[] = [];

          for (const col of collections.slice(0, 3)) {
            try {
              const collection = db.collection(col.name);
              const docs = await collection.find({}).limit(5).toArray();
              
              // Convert ObjectId to string and flatten documents
              const normalizedDocs = docs.map((doc: any) => {
                const normalized: any = { ...doc };
                // Convert _id ObjectId to string
                if (normalized._id && typeof normalized._id === "object" && normalized._id.toString) {
                  normalized._id = normalized._id.toString();
                }
                // Add collection name to each document
                normalized._collection = col.name;
                return normalized;
              });
              
              allRows.push(...normalizedDocs);
            } catch (colError: any) {
              console.warn(`Error fetching from collection ${col.name}:`, colError.message);
              // Continue with other collections
            }
          }

          if (allRows.length === 0) {
            // Return empty dataset if no documents found
            const emptyDataset = DataProcessor.createDataSet(
              [],
              "mongodb",
              sourceName
            );
            return NextResponse.json({ dataset: emptyDataset });
          }

          // ✅ Process and return dataset
          const dataset = DataProcessor.createDataSet(
            allRows,
            "mongodb",
            sourceName
          );
          
          return NextResponse.json({ dataset });
        } catch (connectionError: any) {
          console.error("MongoDB connection error:", connectionError);
          
          // Provide more detailed error messages
          let errorMessage = connectionError?.message || "Database connection failed";
          
          if (connectionError?.code === "ENOTFOUND" || connectionError?.code === "ECONNREFUSED") {
            errorMessage = "Cannot reach MongoDB server. Please check your connection string and network.";
          } else if (connectionError?.code === "EAUTH") {
            errorMessage = "Authentication failed. Please check your username and password.";
          } else if (connectionError?.message?.includes("timeout")) {
            errorMessage = "Connection timeout. Please check your connection string and network.";
          }
          
          return NextResponse.json(
            { 
              error: errorMessage,
              details: process.env.NODE_ENV === "development" ? connectionError?.stack : undefined
            },
            { status: 500 }
          );
        } finally {
          // Always close the connection if it was opened
          if (clientConnected) {
            await client.close().catch((err) => {
              console.error("Error closing MongoDB connection:", err);
            });
          }
        }
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
