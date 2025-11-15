// app/api/text/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAllDatasetIds,
  hasVectorStore,
  getDebugInfo,
  getVectorStore,
  getVectorStoreStatus,
} from "@/lib/vector-store-manager";
import { CohereEmbeddings } from "@langchain/cohere";

/**
 * Enhanced verification endpoint to check if a dataset is indexed and accessible
 * Useful for debugging 404 errors and vector store issues
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");
    const testRetrieval = searchParams.get("testRetrieval") === "true";
    const normalizedDatasetId = datasetId?.trim() || null;

    const allIds = getAllDatasetIds();
    const exists = normalizedDatasetId
      ? hasVectorStore(normalizedDatasetId)
      : false;

    const debugInfo = getDebugInfo();

    // Get detailed status
    const detailedStatus = normalizedDatasetId
      ? getVectorStoreStatus(normalizedDatasetId)
      : null;

    const response: any = {
      datasetId: datasetId || null,
      normalizedDatasetId: normalizedDatasetId,
      exists,
      status: detailedStatus,
      allIndexedDatasets: allIds,
      count: allIds.length,
      debugInfo,
      timestamp: new Date().toISOString(),
    };

    // If requested, test actual retrieval capability
    if (testRetrieval && normalizedDatasetId && exists) {
      console.log(`[Verify] Testing retrieval for: ${normalizedDatasetId}`);

      try {
        // Initialize embeddings
        if (!process.env.COHERE_API_KEY) {
          throw new Error("COHERE_API_KEY not configured");
        }

        const embeddings = new CohereEmbeddings({
          apiKey: process.env.COHERE_API_KEY,
          model: "embed-english-v3.0",
        });

        // Try to get the vector store
        const vectorStore = await getVectorStore(
          normalizedDatasetId,
          embeddings
        );

        if (vectorStore) {
          // Try a test query
          const testResults = await vectorStore.similaritySearch("test", 1);

          response.retrievalTest = {
            success: true,
            retrievedDocs: testResults.length,
            message: "Vector store is accessible and functional",
          };

          console.log(
            `[Verify] ✓ Retrieval test passed for ${normalizedDatasetId}`
          );
        } else {
          response.retrievalTest = {
            success: false,
            message: "Vector store exists in cache but could not be loaded",
          };

          console.warn(
            `[Verify] ⚠️ Vector store could not be loaded for ${normalizedDatasetId}`
          );
        }
      } catch (error: any) {
        response.retrievalTest = {
          success: false,
          error: error.message,
          message: "Error testing retrieval capability",
        };

        console.error(`[Verify] ✗ Retrieval test failed:`, error);
      }
    }

    // Add helpful suggestions if dataset not found
    if (normalizedDatasetId && !exists) {
      response.suggestions = [
        "The dataset may not have been indexed yet",
        "Try re-uploading the document",
        "Check that the datasetId matches exactly (case-sensitive)",
        "View available datasets in the 'allIndexedDatasets' field",
      ];

      // Check for similar IDs
      const similarIds = allIds.filter(
        (id) =>
          id.includes(normalizedDatasetId.split("_")[0]) ||
          normalizedDatasetId.includes(id.split("_")[0])
      );

      if (similarIds.length > 0) {
        response.similarIds = similarIds;
        response.suggestions.push(
          `Found similar dataset IDs: ${similarIds.join(
            ", "
          )}. Check if the full ID matches.`
        );
      }
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Verify] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to verify multiple datasets at once
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { datasetIds } = body;

    if (!Array.isArray(datasetIds)) {
      return NextResponse.json(
        { error: "datasetIds must be an array" },
        { status: 400 }
      );
    }

    const results = datasetIds.map((id) => {
      const normalizedId = id.trim();
      const exists = hasVectorStore(normalizedId);

      return {
        datasetId: id,
        normalizedId,
        exists,
      };
    });

    const allIds = getAllDatasetIds();

    return NextResponse.json({
      results,
      allIndexedDatasets: allIds,
      totalIndexed: allIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Verify] Batch verification error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify datasets",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
