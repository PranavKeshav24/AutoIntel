import { PromptTemplate } from "@langchain/core/prompts";
import { mongoPromptTemplate } from "./prompts";

const MAX_CACHE_SIZE = 50;
const MAX_SCHEMA_SIZE = 50_000; // 50KB limit for individual schemas

/**
 * LRU cache using native Map.
 * Note: For >100 entries or high-throughput scenarios, consider using
 * a dedicated LRU library like 'lru-cache' for better performance.
 */
const promptCache = new Map<string, PromptTemplate>();

/**
 * Creates a formatted prompt for MongoDB query generation from natural language.
 * Uses LRU caching to avoid recreating PromptTemplate instances for repeated schemas.
 * 
 * @param schema - The database schema (collections + fields) as a string
 * @param userRequest - The natural language query request from the user
 * @returns A formatted prompt string ready for LLM consumption
 * @throws {Error} If schema or userRequest is empty, or schema exceeds size limit
 * 
 * @example
 * ```typescript
 * const schema = "users: { name, email, age }";
 * const request = "Find all users older than 25";
 * const prompt = await createMongoPrompt(schema, request);
 * ```
 */
export async function createMongoPrompt(
  schema: string,
  userRequest: string
): Promise<string> {
  if (!schema?.trim() || !userRequest?.trim()) {
    throw new Error("Schema and user request are required");
  }

  const trimmedSchema = schema.trim();
  
  // Reject excessively large schemas to prevent memory issues
  if (trimmedSchema.length > MAX_SCHEMA_SIZE) {
    throw new Error(
      `Schema too large (${trimmedSchema.length} chars). Maximum allowed: ${MAX_SCHEMA_SIZE} chars`
    );
  }

  // Check cache and refresh LRU order
  let prompt = promptCache.get(trimmedSchema);
  
  if (prompt) {
    // Move to end (most recently used)
    promptCache.delete(trimmedSchema);
    promptCache.set(trimmedSchema, prompt);
  } else {
    // Evict least recently used (first entry) if at capacity
    if (promptCache.size >= MAX_CACHE_SIZE) {
      const firstKey = promptCache.keys().next().value;
      if (firstKey !== undefined) {
        promptCache.delete(firstKey);
      }
    }
    
    prompt = new PromptTemplate({
      template: mongoPromptTemplate,
      inputVariables: ["schema", "input"],
    });
    promptCache.set(trimmedSchema, prompt);
  }

  return await prompt.format({
    schema: trimmedSchema,
    input: userRequest.trim(),
  });
}

/**
 * Clears the prompt template cache. Useful for testing or memory management.
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Returns current cache statistics for monitoring.
 */
export function getCacheStats() {
  return {
    size: promptCache.size,
    maxSize: MAX_CACHE_SIZE,
    maxSchemaSize: MAX_SCHEMA_SIZE,
  };
}