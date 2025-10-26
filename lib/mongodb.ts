// lib/mongodb.ts
import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let db: any = null;

export async function connectToMongoDB(uri: string) {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // default DB
  }
  return { client, db };
}
