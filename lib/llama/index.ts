import { MongoClient } from "mongodb";
import OpenAI from "openai";
import {
  BaseLLM,
  Document,
  Settings,
  VectorStoreIndex,
  storageContextFromDefaults,
  type ChatMessage,
  type ChatResponse,
  type ChatResponseChunk,
  type LLMChatParamsNonStreaming,
  type LLMChatParamsStreaming,
  type LLMMetadata,
  type MessageContent,
} from "llamaindex";

type OpenAIRole = "system" | "user" | "assistant";

interface OpenAIChatConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  baseURL?: string;
}

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export class OpenAIChatLLM extends BaseLLM {
  metadata: LLMMetadata;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly topP: number;
  private readonly maxTokens?: number;

  constructor({ apiKey, model, temperature, topP, maxTokens, baseURL }: OpenAIChatConfig) {
    super();

    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model ?? DEFAULT_MODEL;
    this.temperature = temperature ?? 0.2;
    this.topP = topP ?? 1;
    this.maxTokens = maxTokens;
    this.metadata = {
      model: this.model,
      temperature: this.temperature,
      topP: this.topP,
      maxTokens: this.maxTokens,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      tokenizer: undefined,
      structuredOutput: false,
    };
  }

  async chat(
    params: LLMChatParamsStreaming<object, object>
  ): Promise<AsyncIterable<ChatResponseChunk<object>>>;
  async chat(
    params: LLMChatParamsNonStreaming<object, object>
  ): Promise<ChatResponse<object>>;
  async chat(
    params:
      | LLMChatParamsStreaming<object, object>
      | LLMChatParamsNonStreaming<object, object>
  ): Promise<
    AsyncIterable<ChatResponseChunk<object>> | ChatResponse<object>
  > {
    const messages = params.messages.map((message) => this.toOpenAIMessage(message));

    if (params.stream) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        top_p: this.topP,
        max_tokens: this.maxTokens,
        stream: true,
      });

      return (async function* (): AsyncIterable<ChatResponseChunk<object>> {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) continue;

          yield {
            delta,
            raw: chunk,
          };
        }
      })();
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";

    return {
      message: {
        role: "assistant",
        content,
      },
      raw: completion,
    };
  }

  private toOpenAIMessage(message: ChatMessage): {
    role: OpenAIRole;
    content: string;
  } {
    const role = this.normalizeRole(message.role);
    const content = this.normalizeContent(message.content);

    return { role, content };
  }

  private normalizeRole(role: ChatMessage["role"]): OpenAIRole {
    switch (role) {
      case "assistant":
      case "system":
      case "user":
        return role;
      case "memory":
      case "developer":
        return "system";
      default:
        return "user";
    }
  }

  private normalizeContent(content: MessageContent): string {
    if (typeof content === "string") {
      return content;
    }

    return content
      .map((part) => {
        if (part.type === "text") return part.text;
        if (part.type === "image_url") return `[image:${part.image_url.url}]`;
        if ("data" in part && part.data) return `[${part.type} payload]`;
        return JSON.stringify(part);
      })
      .join("\n");
  }
}

const openAiApiKey = process.env.OPENAI_API_KEY;

if (openAiApiKey) {
  // --- Configure OpenAI globally for LlamaIndex ---
  Settings.llm = new OpenAIChatLLM({
    apiKey: openAiApiKey,
  });
}

// --- Cache index per connection ---
const indexCache = new Map<string, VectorStoreIndex>();

export async function buildMongoIndex(
  connectionString: string
): Promise<VectorStoreIndex> {
  const cachedIndex = indexCache.get(connectionString);
  if (cachedIndex) {
    console.log("⚡ Using cached LlamaIndex for", connectionString);
    return cachedIndex;
  }

  const client = new MongoClient(connectionString);
  await client.connect();

  try {
    const dbName = connectionString.split("/").pop()?.split("?")[0] || "test";
    const db = client.db(dbName);

    const collections = await db.listCollections().toArray();
    if (!collections.length) throw new Error("No collections found in database");

    const allDocs: Document[] = [];

    for (const collection of collections) {
      const col = db.collection(collection.name);
      const documents = await col.find({}).limit(100).toArray();

      for (const rawDoc of documents) {
        const id = `${collection.name}_${rawDoc._id?.toString?.() ?? rawDoc._id}`;
        const serialized = JSON.stringify(rawDoc, (_, value) => {
          if (
            value &&
            typeof value === "object" &&
            "toString" in value &&
            typeof (value as { toString: unknown }).toString === "function"
          ) {
            const withBsonType = value as {
              _bsontype?: string;
              toString: () => string;
            };
            if (withBsonType._bsontype === "ObjectID") {
              return withBsonType.toString();
            }
          }
          return value;
        });

        allDocs.push(
          new Document({
            id_: id,
            text: serialized,
            metadata: { collection: collection.name },
          })
        );
      }
    }

    if (!allDocs.length) throw new Error("No documents found in collections");

    const storageContext = await storageContextFromDefaults({});
    const index = await VectorStoreIndex.fromDocuments(allDocs, { storageContext });

    indexCache.set(connectionString, index);
    return index;
  } finally {
    await client.close();
  }
}

export async function queryMongoData(
  index: VectorStoreIndex,
  query: string
): Promise<string> {
  const queryEngine = index.asQueryEngine();
  const response = await queryEngine.query({ query });
  return response.toString();
}

