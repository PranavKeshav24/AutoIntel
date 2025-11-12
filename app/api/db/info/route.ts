import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

interface DbInfoRequestBody {
  connectionString?: string;
}

interface CollectionSummary {
  name: string;
  documentCount: number;
}

interface DbInfoResponseBody {
  database: string;
  totalCollections: number;
  collections: CollectionSummary[];
}

export async function POST(request: NextRequest) {
  let client: MongoClient | undefined;

  try {
    const { connectionString }: DbInfoRequestBody = await request.json();

    if (!connectionString || typeof connectionString !== "string") {
      return NextResponse.json(
        { error: "Missing MongoDB connection string" },
        { status: 400 }
      );
    }

    client = new MongoClient(connectionString);
    await client.connect();

    const db = client.db();
    const collections = await db.listCollections().toArray();

    const summaries: CollectionSummary[] = [];
    for (const { name } of collections) {
      const collection = db.collection(name);
      const count = await collection.countDocuments();
      summaries.push({ name, documentCount: count });
    }

    const response: DbInfoResponseBody = {
      database: db.databaseName,
      totalCollections: collections.length,
      collections: summaries,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/db/info:", error);
    return NextResponse.json(
      { error: "Failed to fetch database info", details: message },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.warn("Failed to close MongoDB client:", closeError);
      }
    }
  }
}
