import {
  DataSet,
  VectorChunk,
  ChatSession,
  DatasetIndex,
  ChatMessage,
} from "@/lib/types";

/**
 * Vector Service using Hugging Face embeddings and Pinecone for storage
 * Falls back to localStorage if Pinecone is not configured
 */
export class VectorService {
  private static readonly DATASETS_KEY = "indexed_datasets";
  private static readonly CHUNKS_KEY = "vector_chunks";
  private static readonly SESSIONS_KEY = "chat_sessions";

  // Hugging Face Inference API - sentence-transformers/all-MiniLM-L6-v2
  // Handles up to 512 tokens, good for chunked data
  private static readonly HF_ENDPOINT =
    "https://lsezom5zl8d7iou9.us-east-1.aws.endpoints.huggingface.cloud";

  /**
   * Create embedding using Hugging Face API with chunking for large text
   */
  static async createEmbedding(
    text: string,
    apiKey: string
  ): Promise<number[]> {
    try {
      // Truncate text to avoid token limit (roughly 2000 chars = 512 tokens)
      const truncatedText = text.substring(0, 2000);

      const response = await fetch(this.HF_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: truncatedText,
          options: { wait_for_model: true },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("HF API Error:", error);
        throw new Error("Failed to create embedding");
      }

      const data = await response.json();
      // HF returns nested array, flatten it
      return Array.isArray(data[0]) ? data[0] : data;
    } catch (error) {
      console.error("Embedding error:", error);
      throw error;
    }
  }

  /**
   * Chunk dataset into searchable pieces with smaller chunk size
   */
  static chunkDataset(dataset: DataSet, chunkSize: number = 10): VectorChunk[] {
    const chunks: VectorChunk[] = [];
    const rows = dataset.rows;
    const columns = dataset.schema.fields.map((f) => f.name);

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunkRows = rows.slice(i, Math.min(i + chunkSize, rows.length));

      // Create concise text representation
      const text = this.rowsToText(chunkRows, columns);

      const chunk: VectorChunk = {
        id: `${dataset.id}_chunk_${Math.floor(i / chunkSize)}`,
        text,
        metadata: {
          datasetId: dataset.id!,
          datasetName: dataset.source.name || "Unknown",
          sourceType: dataset.source.kind,
          chunkIndex: Math.floor(i / chunkSize),
          rowRange: [i, Math.min(i + chunkSize, rows.length) - 1],
          columnNames: columns,
        },
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Convert rows to concise text format
   */
  private static rowsToText(rows: any[], columns: string[]): string {
    const lines: string[] = [];

    // Add header
    lines.push(`Columns: ${columns.join(", ")}`);

    // Add rows in compact format
    rows.forEach((row) => {
      const values = columns
        .map((col) => this.formatValue(row[col]))
        .join(" | ");
      lines.push(values);
    });

    return lines.join("\n");
  }

  private static formatValue(val: any): string {
    if (val === null || val === undefined) return "null";
    if (val instanceof Date) return val.toISOString().split("T")[0];
    if (typeof val === "number") return val.toFixed(2);
    return String(val).substring(0, 50); // Limit field length
  }

  /**
   * Index a dataset with progress tracking
   */
  static async indexDataset(
    dataset: DataSet,
    apiKey: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      // Generate unique ID if not present
      if (!dataset.id) {
        dataset.id = `ds_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      // Chunk the dataset with smaller chunks
      const chunks = this.chunkDataset(dataset, 10);

      console.log(`Indexing ${chunks.length} chunks for dataset ${dataset.id}`);

      // Create embeddings with retry logic
      const chunksWithEmbeddings: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const embedding = await this.createEmbedding(chunk.text, apiKey);

          chunksWithEmbeddings.push({
            ...chunk,
            embedding,
          });

          if (onProgress) {
            onProgress(((i + 1) / chunks.length) * 100);
          }
        } catch (err) {
          console.error(`Failed to embed chunk ${i}:`, err);
          // Continue with other chunks
        }
      }

      if (chunksWithEmbeddings.length === 0) {
        throw new Error("Failed to create any embeddings");
      }

      // Save chunks
      this.saveChunks(chunksWithEmbeddings);

      // Create dataset index
      const index: DatasetIndex = {
        id: dataset.id,
        datasetName: dataset.source.name || "Unknown",
        sourceType: dataset.source.kind,
        rowCount: dataset.rows.length,
        columnCount: dataset.schema.fields.length,
        chunkCount: chunksWithEmbeddings.length,
        indexedAt: new Date(),
        status: "ready",
      };

      this.saveDatasetIndex(index);

      console.log(`Successfully indexed ${chunksWithEmbeddings.length} chunks`);
    } catch (error) {
      console.error("Indexing error:", error);
      throw error;
    }
  }

  /**
   * Semantic search across datasets with debugging
   */
  static async search(
    query: string,
    datasetIds: string[],
    apiKey: string,
    topK: number = 5
  ): Promise<Array<{ chunk: VectorChunk; score: number }>> {
    try {
      console.log(`Searching for: "${query}" in datasets:`, datasetIds);

      // Create query embedding
      const queryEmbedding = await this.createEmbedding(query, apiKey);
      console.log("Query embedding created, length:", queryEmbedding.length);

      // Get all chunks for specified datasets
      const allChunks = this.getChunks();
      console.log("Total chunks in storage:", allChunks.length);

      const relevantChunks = allChunks.filter((c) =>
        datasetIds.includes(c.metadata.datasetId)
      );
      console.log(
        "Relevant chunks for selected datasets:",
        relevantChunks.length
      );

      if (relevantChunks.length === 0) {
        console.warn("No chunks found for selected datasets");
        return [];
      }

      // Calculate similarities
      const results = relevantChunks
        .map((chunk) => {
          const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          return {
            chunk: {
              id: chunk.id,
              text: chunk.text,
              metadata: chunk.metadata,
            },
            score,
          };
        })
        .filter((r) => r.score > 0.3) // Lower threshold for better recall
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log(`Found ${results.length} relevant chunks`);
      results.forEach((r, i) => {
        console.log(
          `  ${i + 1}. Score: ${r.score.toFixed(3)}, Dataset: ${
            r.chunk.metadata.datasetName
          }`
        );
      });

      return results;
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  /**
   * Cosine similarity calculation
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) {
      console.error("Invalid embeddings for similarity calculation");
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Storage operations
   */
  private static saveChunks(chunks: any[]): void {
    const existing = this.getChunks();
    // Remove old chunks for the same dataset
    const datasetIds = chunks.map((c) => c.metadata.datasetId);
    const filtered = existing.filter(
      (c) => !datasetIds.includes(c.metadata.datasetId)
    );
    const updated = [...filtered, ...chunks];
    localStorage.setItem(this.CHUNKS_KEY, JSON.stringify(updated));
  }

  private static getChunks(): any[] {
    try {
      const data = localStorage.getItem(this.CHUNKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveDatasetIndex(index: DatasetIndex): void {
    const existing = this.getDatasetIndices();
    const filtered = existing.filter((d) => d.id !== index.id);
    filtered.push(index);
    localStorage.setItem(this.DATASETS_KEY, JSON.stringify(filtered));
  }

  static getDatasetIndices(): DatasetIndex[] {
    try {
      const data = localStorage.getItem(this.DATASETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static getDatasetIndex(id: string): DatasetIndex | null {
    const indices = this.getDatasetIndices();
    return indices.find((i) => i.id === id) || null;
  }

  static deleteDatasetIndex(id: string): void {
    const indices = this.getDatasetIndices();
    const filtered = indices.filter((i) => i.id !== id);
    localStorage.setItem(this.DATASETS_KEY, JSON.stringify(filtered));

    const chunks = this.getChunks();
    const filteredChunks = chunks.filter((c) => c.metadata.datasetId !== id);
    localStorage.setItem(this.CHUNKS_KEY, JSON.stringify(filteredChunks));
  }

  /**
   * Chat session management
   */
  static createChatSession(title: string, datasetIds: string[]): ChatSession {
    const session: ChatSession = {
      id: `chat_${Date.now()}`,
      title,
      datasetIds,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sessions = this.getChatSessions();
    sessions.push(session);
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

    return session;
  }

  static getChatSessions(): ChatSession[] {
    try {
      const data = localStorage.getItem(this.SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static getChatSession(id: string): ChatSession | null {
    const sessions = this.getChatSessions();
    return sessions.find((s) => s.id === id) || null;
  }

  static updateChatSession(session: ChatSession): void {
    const sessions = this.getChatSessions();
    const index = sessions.findIndex((s) => s.id === session.id);

    if (index >= 0) {
      sessions[index] = { ...session, updatedAt: new Date() };
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    }
  }

  static deleteChatSession(id: string): void {
    const sessions = this.getChatSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(filtered));
  }

  static addMessageToSession(
    sessionId: string,
    message: Omit<ChatMessage, "id" | "timestamp">
  ): void {
    const session = this.getChatSession(sessionId);
    if (!session) return;

    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}`,
      timestamp: new Date(),
    };

    session.messages.push(newMessage);
    this.updateChatSession(session);
  }
}
