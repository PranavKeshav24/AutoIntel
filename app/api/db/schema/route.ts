import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface SchemaRequestBody {
  connectionString?: string;
  sampleSize?: number;
}

type FieldTypeSummary = Record<string, string[]>;
type CollectionSchemaSummary = Record<string, FieldTypeSummary>;

interface SchemaResponseBody {
  database: string;
  schema: CollectionSchemaSummary;
}

function inferType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value;
}

export async function POST(request: NextRequest) {
  let client: MongoClient | undefined;

  try {
    const body: SchemaRequestBody = await request.json();
    const { connectionString, sampleSize = 5 } = body;

    if (!connectionString || typeof connectionString !== "string") {
      return NextResponse.json(
        { error: "Missing MongoDB connection string" },
        { status: 400 }
      );
    }

    const limit =
      typeof sampleSize === "number" && Number.isFinite(sampleSize)
        ? Math.max(1, Math.floor(sampleSize))
        : 5;

    client = new MongoClient(connectionString);
    await client.connect();

    const db = client.db();
    const collections = await db.listCollections().toArray();

    const schemaSummary: CollectionSchemaSummary = {};

    for (const { name } of collections) {
      const collection = db.collection(name);
      const sampleDocs = await collection.find({}).limit(limit).toArray();

      const fieldTypes: Record<string, Set<string>> = {};

      for (const doc of sampleDocs) {
        Object.entries(doc as Record<string, JsonValue>).forEach(
          ([key, value]) => {
            if (!fieldTypes[key]) fieldTypes[key] = new Set<string>();
            fieldTypes[key].add(inferType(value));
          }
        );
      }

      schemaSummary[name] = Object.fromEntries(
        Object.entries(fieldTypes).map(([field, types]) => [
          field,
          Array.from(types),
        ])
      );
    }

    const response: SchemaResponseBody = {
      database: db.databaseName,
      schema: schemaSummary,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/db/schema:", error);
    return NextResponse.json(
      { error: "Failed to fetch database schema", details: message },
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
