// app/api/text/index/route.ts
import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { CohereEmbeddings } from "@langchain/cohere";
import {
  createVectorStore,
  hasVectorStore,
  getAllDatasetIds,
} from "@/lib/vector-store-manager";

interface IndexRequestBody {
  datasetId: string;
  text: string;
  metadata?: Record<string, unknown>;
  chunk?: {
    size?: number;
    overlap?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IndexRequestBody;
    const { datasetId, text, metadata = {}, chunk } = body;

    // Normalize datasetId to avoid whitespace issues
    const normalizedDatasetId = datasetId?.trim();
    console.log(
      `[Index] Received indexing request for datasetId: "${normalizedDatasetId}" (length: ${normalizedDatasetId?.length}), text length: ${text?.length}`
    );

    if (!normalizedDatasetId || !text) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "Both datasetId and text are required.",
        },
        { status: 400 }
      );
    }

    if (!process.env.COHERE_API_KEY) {
      throw new Error("COHERE_API_KEY is not configured.");
    }

    // Check if already indexed
    if (hasVectorStore(normalizedDatasetId)) {
      console.log(
        `[Index] Dataset "${normalizedDatasetId}" is already indexed. Skipping re-indexing.`
      );
      return NextResponse.json({
        chunkCount: 0,
        message: "Dataset already indexed.",
        datasetId: normalizedDatasetId,
        alreadyIndexed: true,
      });
    }

    console.log(
      `[Index] Starting indexing process for: ${normalizedDatasetId}`
    );

    // Initialize embeddings model (Cohere)
    const embeddings = new CohereEmbeddings({
      apiKey: process.env.COHERE_API_KEY,
      model: "embed-english-v3.0",
    });

    // Split documents using RecursiveCharacterTextSplitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunk?.size ?? 1000,
      chunkOverlap: chunk?.overlap ?? 200,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    const baseDocument = new Document({
      pageContent: text,
      metadata: {
        datasetId: normalizedDatasetId,
        ...metadata,
      },
    });

    console.log(`[Index] Splitting document into chunks...`);
    const allSplits = await splitter.splitDocuments([baseDocument]);

    // Add chunk metadata
    allSplits.forEach((doc, index) => {
      doc.metadata = {
        ...doc.metadata,
        chunkIndex: index,
        totalChunks: allSplits.length,
        datasetId: normalizedDatasetId, // Ensure datasetId is in every chunk
      };
    });

    console.log(
      `[Index] Created ${allSplits.length} chunks for datasetId: "${normalizedDatasetId}"`
    );

    // Store documents in vector store (handles both in-memory cache and Pinecone)
    console.log(
      `[Index] Creating vector store for datasetId: "${normalizedDatasetId}"`
    );

    const startTime = Date.now();
    await createVectorStore(normalizedDatasetId, allSplits, embeddings);
    const indexDuration = Date.now() - startTime;

    console.log(`[Index] Vector store creation took ${indexDuration}ms`);

    // Verify the store was created locally
    const verified = hasVectorStore(normalizedDatasetId);
    const allIds = getAllDatasetIds();

    console.log(
      `[Index] Vector store created and verified locally: ${verified} for datasetId: "${normalizedDatasetId}"`
    );
    console.log(`[Index] Total vector stores in memory: ${allIds.length}`);
    console.log(`[Index] All dataset IDs:`, allIds);

    if (!verified) {
      throw new Error(
        `Vector store was not created successfully for datasetId: "${normalizedDatasetId}"`
      );
    }

    // Add a small delay to allow Pinecone propagation
    // This is a best-effort to reduce "not found" issues immediately after indexing
    console.log(`[Index] Waiting 1s for Pinecone propagation...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`[Index] ✓ Indexing complete for: ${normalizedDatasetId}`);

    return NextResponse.json({
      chunkCount: allSplits.length,
      message:
        "Dataset indexed successfully. Note: Pinecone propagation may take a few seconds.",
      datasetId: normalizedDatasetId,
      alreadyIndexed: false,
      chunkSize: chunk?.size ?? 1000,
      chunkOverlap: chunk?.overlap ?? 200,
      indexDuration: `${indexDuration}ms`,
      timestamp: new Date().toISOString(),
      note: "If you get 'not found' errors immediately after indexing, wait 2-3 seconds and retry.",
    });
  } catch (error: any) {
    console.error("[Index] Text indexing error:", error);
    return NextResponse.json(
      {
        error: "Failed to index dataset",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
