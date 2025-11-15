// lib/mongodb.ts
import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let db: any = null;

export async function connectToMongoDB(uri: string, dbName?: string) {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();

    
    db = dbName ? client.db(dbName) : client.db();
  }

  return { client, db };
}
