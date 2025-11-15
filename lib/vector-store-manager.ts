// lib/vector-store-manager.ts
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

/**
 * Pinecone-backed Vector Store Manager (doc-driven init)
 *
 * Key change: persistence to Pinecone is now best-effort and runs
 * asynchronously (fire-and-forget). createVectorStore returns quickly
 * with an in-memory MemoryVectorStore, avoiding long blocking waits
 * on Pinecone upserts.
 */

// ---------- Types ----------
interface StoredVectorData {
  documents: Array<{
    pageContent: string;
    metadata: Record<string, any>;
  }>;
  createdAt: number;
}

// ---------- Local warm caches ----------
const vectorStoreCache = new Map<string, MemoryVectorStore>();
const documentCache = new Map<string, StoredVectorData>();

// ---------- Pinecone initialization (per docs) ----------
let pineconeIndex: any | null = null;
let pineconeConfigured = false;

function initPineconeIfNeeded() {
  if (pineconeConfigured) return;
  pineconeConfigured = true;

  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;

  if (!apiKey || !indexName) {
    console.warn(
      "[VectorStore][Pinecone] PINECONE_API_KEY or PINECONE_INDEX not set — Pinecone persistence disabled."
    );
    pineconeIndex = null;
    return;
  }

  try {
    // Attempt the standard Pinecone client init. If your environment needs `client.init({ apiKey, environment })`
    // adjust this accordingly (this guard keeps it non-fatal).
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pinecone = new Pinecone({ apiKey });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pineconeIndex = pinecone.Index(indexName);
    console.log(`[VectorStore][Pinecone] Initialized index "${indexName}"`);
  } catch (err) {
    console.warn("[VectorStore][Pinecone] Init failed:", err);
    pineconeIndex = null;
  }
}

// Helper id generator (for possible upserts if needed)
let localIdCounter = 0;
function makeVectorId(datasetId: string, idx: number) {
  localIdCounter += 1;
  return `${datasetId}-${Date.now()}-${idx}-${localIdCounter}`;
}

// ---------------- Core exported functions ----------------

/**
 * Background helper to persist to Pinecone (best-effort).
 * This is intentionally non-blocking for callers.
 */
async function persistVectorStoreToPinecone(
  datasetId: string,
  documents: Document[],
  embeddings: Embeddings
) {
  try {
    initPineconeIfNeeded();
    if (!pineconeIndex) {
      console.log(
        `[VectorStore][Pinecone] Pinecone not configured; skipping background persistence for ${datasetId}.`
      );
      return;
    }

    console.log(
      `[VectorStore][Pinecone] Starting background persistence for dataset: ${datasetId} (docs=${documents.length})`
    );

    // Use LangChain's helper to embed & upsert into Pinecone.
    // We intentionally do NOT await this from the index route (fire-and-forget).
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex,
      namespace: datasetId,
    });

    console.log(
      `[VectorStore][Pinecone] Background persistence complete for ${datasetId}`
    );
  } catch (err) {
    console.warn(
      `[VectorStore][Pinecone] Background persist failed for ${datasetId} (non-fatal):`,
      err
    );
  }
}

/**
 * Create and store a vector store for a dataset
 *
 * Returns: Promise<MemoryVectorStore>
 *
 * IMPORTANT: This function will create and cache an in-memory MemoryVectorStore
 * and return quickly. If Pinecone is configured, we will also persist to Pinecone in
 * the background without blocking the response.
 */
export async function createVectorStore(
  datasetId: string,
  documents: Document[],
  embeddings: Embeddings
): Promise<MemoryVectorStore> {
  console.log(
    `[VectorStore] Creating vector store (in-memory) for: ${datasetId}`
  );

  // 1) Create in-memory vector store (returned to caller to preserve compatibility)
  const memoryStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  );

  // 2) Warm cache
  vectorStoreCache.set(datasetId, memoryStore);
  documentCache.set(datasetId, {
    documents: documents.map((d) => ({
      pageContent: d.pageContent,
      metadata: { ...(d.metadata || {}) },
    })),
    createdAt: Date.now(),
  });

  // 3) Persist to Pinecone in background (best-effort)
  initPineconeIfNeeded();
  if (!pineconeIndex) {
    console.log(
      "[VectorStore][Pinecone] Pinecone not configured; skipped background persistence."
    );
    return memoryStore;
  }

  // Fire-and-forget; do not block the caller.
  (async () => {
    await persistVectorStoreToPinecone(datasetId, documents, embeddings);
  })();

  console.log(
    `[VectorStore] Stored ${documents.length} documents for ${datasetId} (in-memory). Background persist started (if configured).`
  );
  return memoryStore;
}

/**
 * Get a vector store by dataset ID
 * If not in warm cache, attempt to recreate from local document cache or Pinecone (if configured).
 *
 * Returns: Promise<MemoryVectorStore | null>
 */
export async function getVectorStore(
  datasetId: string,
  embeddings?: Embeddings
): Promise<MemoryVectorStore | null> {
  console.log(`[VectorStore] Looking up: ${datasetId}`);

  // 1) Warm cache
  if (vectorStoreCache.has(datasetId)) {
    console.log(`[VectorStore] Found in cache: ${datasetId}`);
    return vectorStoreCache.get(datasetId)!;
  }

  // 2) Recreate from local document cache (fast) — requires embeddings to re-create vectors
  if (documentCache.has(datasetId) && embeddings) {
    console.log(
      `[VectorStore] Recreating from local document cache: ${datasetId}`
    );
    const stored = documentCache.get(datasetId)!;
    const docs = stored.documents.map(
      (d) => new Document({ pageContent: d.pageContent, metadata: d.metadata })
    );
    const recreated = await MemoryVectorStore.fromDocuments(docs, embeddings);
    vectorStoreCache.set(datasetId, recreated);
    return recreated;
  }

  // 3) Try to reconstruct from Pinecone (cold-start). Embeddings required to build MemoryVectorStore.
  initPineconeIfNeeded();
  if (!pineconeIndex) {
    console.log(
      `[VectorStore][Pinecone] Pinecone not configured and no local cache found for ${datasetId}`
    );
    return null;
  }

  if (!embeddings) {
    console.log(
      `[VectorStore] Embeddings required to recreate MemoryVectorStore from Pinecone for ${datasetId}`
    );
    return null;
  }

  try {
    // Probe: embed an empty/short query then ask for many results to attempt to fetch namespace contents.
    const probeVec = await embeddings.embedQuery("");
    const TOP_K = 1024;

    // Query Pinecone index for topK in the dataset namespace with metadata
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const resp = await pineconeIndex.query({
      vector: probeVec,
      topK: TOP_K,
      includeMetadata: true,
      namespace: datasetId,
    });

    const matches = resp?.matches ?? resp?.results ?? [];
    if (!matches || matches.length === 0) {
      console.log(
        `[VectorStore][Pinecone] No matches returned from Pinecone for namespace ${datasetId}`
      );
      return null;
    }

    // Build Documents from metadata (we expect pageContent/text stored in metadata)
    const documents: Document[] = matches
      .map((m: any) => {
        const meta = m.metadata ?? {};
        const pageContent = meta.pageContent ?? meta.text ?? meta.content ?? "";
        const safeMeta = { ...meta };
        delete safeMeta.pageContent;
        delete safeMeta.text;
        delete safeMeta.content;
        return new Document({ pageContent, metadata: safeMeta });
      })
      .filter((d: any) => !!d.pageContent);

    if (documents.length === 0) {
      console.log(
        `[VectorStore][Pinecone] Could not build documents from Pinecone metadata for ${datasetId}`
      );
      return null;
    }

    // Recreate MemoryVectorStore using provided embeddings and cache
    const recreated = await MemoryVectorStore.fromDocuments(
      documents,
      embeddings
    );
    vectorStoreCache.set(datasetId, recreated);
    documentCache.set(datasetId, {
      documents: documents.map((d) => ({
        pageContent: d.pageContent,
        metadata: { ...(d.metadata || {}) },
      })),
      createdAt: Date.now(),
    });

    console.log(
      `[VectorStore] Recreated MemoryVectorStore from Pinecone for ${datasetId} (${documents.length} docs)`
    );
    return recreated;
  } catch (err) {
    console.warn(
      "[VectorStore][Pinecone] Error reconstructing from Pinecone:",
      err
    );
    return null;
  }
}

/**
 * Check if a vector store exists (keeps original synchronous signature)
 */
export function hasVectorStore(datasetId: string): boolean {
  return documentCache.has(datasetId) || vectorStoreCache.has(datasetId);
}

/**
 * Get all dataset IDs (synchronous, from local document cache)
 */
export function getAllDatasetIds(): string[] {
  return Array.from(documentCache.keys());
}

/**
 * Delete a vector store (synchronous return as before)
 */
export function deleteVectorStore(datasetId: string): boolean {
  vectorStoreCache.delete(datasetId);
  const locallyDeleted = documentCache.delete(datasetId);

  // Fire-and-forget Pinecone delete
  (async () => {
    try {
      initPineconeIfNeeded();
      if (!pineconeIndex) {
        console.log(
          "[VectorStore][Pinecone] Pinecone not configured; nothing to delete remotely."
        );
        return;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await pineconeIndex.delete({ namespace: datasetId, deleteAll: true });
      console.log(`[VectorStore][Pinecone] Deleted namespace ${datasetId}`);
    } catch (err) {
      console.warn(
        "[VectorStore][Pinecone] Failed to delete namespace (non-fatal):",
        err
      );
    }
  })();

  return locallyDeleted;
}

/**
 * Clear all vector stores (local caches only)
 */
export function clearAllVectorStores(): void {
  vectorStoreCache.clear();
  documentCache.clear();
  console.log("[VectorStore] All local caches cleared");
}

/**
 * Get debug info about cache state
 */
export function getDebugInfo() {
  return {
    vectorStoreCount: vectorStoreCache.size,
    documentCacheCount: documentCache.size,
    datasetIds: Array.from(documentCache.keys()),
    cacheAge: Array.from(documentCache.entries()).map(([id, data]) => ({
      id,
      age: Date.now() - data.createdAt,
      documentCount: data.documents.length,
    })),
  };
}

export function getVectorStoreStatus(datasetId: string): {
  existsInMemory: boolean;
  existsInDocCache: boolean;
  exists: boolean;
  documentCount?: number;
  cacheAge?: number;
} {
  const inMemory = vectorStoreCache.has(datasetId);
  const inDocCache = documentCache.has(datasetId);

  const status = {
    existsInMemory: inMemory,
    existsInDocCache: inDocCache,
    exists: inMemory || inDocCache,
  };

  if (inDocCache) {
    const cached = documentCache.get(datasetId);
    return {
      ...status,
      documentCount: cached?.documents.length,
      cacheAge: cached ? Date.now() - cached.createdAt : undefined,
    };
  }

  return status;
}

/**
 * Force refresh a vector store from Pinecone (async)
 */
export async function refreshVectorStoreFromPinecone(
  datasetId: string,
  embeddings: Embeddings
): Promise<boolean> {
  try {
    console.log(`[VectorStore] Force refreshing from Pinecone: ${datasetId}`);

    initPineconeIfNeeded();
    if (!pineconeIndex) {
      console.warn("[VectorStore] Pinecone not configured");
      return false;
    }

    const probeVec = await embeddings.embedQuery("");
    const TOP_K = 2048;

    const resp = await pineconeIndex.query({
      vector: probeVec,
      topK: TOP_K,
      includeMetadata: true,
      namespace: datasetId,
    });

    const matches = resp?.matches ?? resp?.results ?? [];
    if (!matches || matches.length === 0) {
      console.warn(
        `[VectorStore] No vectors found in Pinecone for ${datasetId}`
      );
      return false;
    }

    const documents: Document[] = matches
      .map((m: any) => {
        const meta = m.metadata ?? {};
        const pageContent = meta.pageContent ?? meta.text ?? meta.content ?? "";
        const safeMeta = { ...meta };
        delete safeMeta.pageContent;
        delete safeMeta.text;
        delete safeMeta.content;
        return new Document({ pageContent, metadata: safeMeta });
      })
      .filter((d: any) => !!d.pageContent);

    if (documents.length === 0) {
      console.warn(
        `[VectorStore] No valid documents reconstructed from Pinecone`
      );
      return false;
    }

    const recreated = await MemoryVectorStore.fromDocuments(
      documents,
      embeddings
    );
    vectorStoreCache.set(datasetId, recreated);
    documentCache.set(datasetId, {
      documents: documents.map((d) => ({
        pageContent: d.pageContent,
        metadata: { ...(d.metadata || {}) },
      })),
      createdAt: Date.now(),
    });

    console.log(
      `[VectorStore] Successfully refreshed from Pinecone: ${documents.length} docs`
    );
    return true;
  } catch (err) {
    console.error("[VectorStore] Error refreshing from Pinecone:", err);
    return false;
  }
}

/**
 * Wait for vector store to become available
 */
export async function waitForVectorStore(
  datasetId: string,
  embeddings: Embeddings,
  options?: {
    maxAttempts?: number;
    delayMs?: number;
  }
): Promise<MemoryVectorStore | null> {
  const maxAttempts = options?.maxAttempts || 5;
  const delayMs = options?.delayMs || 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[VectorStore] Waiting for ${datasetId} (attempt ${attempt}/${maxAttempts})`
    );

    const store = await getVectorStore(datasetId, embeddings);
    if (store) {
      console.log(`[VectorStore] Found on attempt ${attempt}`);
      return store;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.warn(
    `[VectorStore] ${datasetId} not available after ${maxAttempts} attempts`
  );
  return null;
}
