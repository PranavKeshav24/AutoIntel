// lib/mongodb.ts
import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let db: any = null;

export async function connectToMongoDB(uri: string, dbName?: string) {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();

    // If dbName is provided, use it.
    // Otherwise, use the database defined inside the URI.
    db = dbName ? client.db(dbName) : client.db();
  }

  return { client, db };
}
