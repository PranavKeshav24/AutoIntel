import { NextResponse } from "next/server";
import { MongoClient, Db, MongoServerError } from "mongodb";
import { z } from "zod";
import { createMongoPrompt } from "@/lib/mongoLangChain";
import { getLing1TLLM } from "@/app/api/llm";
import mongoToDataset from "@/lib/mongoToDataset";


const MongoOperationSchema = z.enum([
  "find",
  "aggregate",
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
]);

const MongoQuerySchema = z.object({
  operation: MongoOperationSchema,
  collection: z.string().regex(/^[a-zA-Z0-9_.-]+$/, "Invalid collection name"),
  query: z.any(),
  options: z.any().optional(),
});

const RequestBodySchema = z.object({
  schema: z.string().min(1).max(50_000),
  userRequest: z.string().min(1).max(1_000),
  connectionString: z.string().startsWith("mongodb"),
  dryRun: z.boolean().optional().default(false),
});

// --- Types ---
type MongoOperation = z.infer<typeof MongoOperationSchema>;
type MongoQuery = z.infer<typeof MongoQuerySchema>;
type RequestBody = z.infer<typeof RequestBodySchema>;

interface ApiResponse {
  success: boolean;
  result?: any;
  generatedQuery?: MongoQuery;
  error?: string;
  errorCode?: string;
  metadata?: {
    executionTimeMs: number;
    operation: string;
    collection: string;
    affectedDocuments?: number;
    totalTimeMs?: number;
    cached?: boolean;
  };
}

// --- Error Codes ---
enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  LLM_PARSING_ERROR = "LLM_PARSING_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  QUERY_EXECUTION_ERROR = "QUERY_EXECUTION_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  UNSAFE_OPERATION = "UNSAFE_OPERATION",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// --- Constants ---
const CONNECTION_TIMEOUT = 10_000;
const QUERY_TIMEOUT = 30_000; // Max time for query execution
const MAX_RESULT_SIZE = 10_000;
const DANGEROUS_OPERATIONS = ["updateMany", "deleteMany"];
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache (use Redis in production)
const queryCache = new Map<string, { result: any; timestamp: number }>();
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// --- Rate Limiting ---
const RATE_LIMIT = {
  MAX_REQUESTS: 10,
  WINDOW_MS: 60_000, // 1 minute
};

function getRateLimitKey(req: Request): string {
  // Use IP address or user ID in production
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  return `rate_limit:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT.WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT.MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// --- Input Sanitization ---
function sanitizeInput(input: string): string {
  // Remove potential injection patterns
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/\${.*?}/g, "") // Remove template literals
    .replace(/`/g, "'") // Replace backticks
    .trim();
}

function sanitizeConnectionString(connStr: string): string {
  return connStr.replace(/\/\/([^:]+):([^@]+)@/, "//*****:*****@");
}

// --- Caching ---
function getCacheKey(schema: string, userRequest: string): string {
  return `cache:${schema.slice(0, 100)}:${userRequest}`;
}

function getFromCache(key: string): any | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }

  return cached.result;
}

function setCache(key: string, result: any): void {
  queryCache.set(key, { result, timestamp: Date.now() });

  // Cleanup old entries (simple LRU)
  if (queryCache.size > 100) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }
}

// --- Query Parsing & Validation ---
function parseGeneratedQuery(queryStr: string): MongoQuery {
  let parsed: any;

  try {
    parsed = JSON.parse(queryStr);
  } catch (err) {
    throw {
      code: ErrorCode.LLM_PARSING_ERROR,
      message: `LLM returned invalid JSON: ${(err as Error).message}`,
      statusCode: 422,
    };
  }

  // Validate with Zod
  const validationResult = MongoQuerySchema.safeParse(parsed);
  if (!validationResult.success) {
    throw {
      code: ErrorCode.LLM_PARSING_ERROR,
      message: `Invalid query structure: ${validationResult.error.message}`,
      statusCode: 422,
    };
  }

  const mongoQuery = validationResult.data;

  // Safety check for dangerous operations
  if (DANGEROUS_OPERATIONS.includes(mongoQuery.operation)) {
    if (
      !mongoQuery.query?.filter ||
      typeof mongoQuery.query.filter !== "object" ||
      Object.keys(mongoQuery.query.filter).length === 0
    ) {
      throw {
        code: ErrorCode.UNSAFE_OPERATION,
        message: `${mongoQuery.operation} requires a non-empty filter to prevent mass modifications`,
        statusCode: 400,
      };
    }
  }

  return mongoQuery;
}
async function inferSchema(db: Db, collectionName: string, sampleSize = 5) {
  const sample = await db.collection(collectionName).find({}).limit(sampleSize).toArray();
  const schema: Record<string, string> = {};

  if (!sample || sample.length === 0) return {};

  for (const doc of sample) {
    Object.keys(doc).forEach(key => {
      schema[key] = typeof doc[key];
    });
  }

  return schema;
}


// --- Query Execution ---
async function executeMongoOperation(
  db: Db,
  mongoQuery: MongoQuery,
  dryRun: boolean = false
): Promise<{ result: any; metadata: any }> {
  const { operation, collection, query, options } = mongoQuery;
  const coll = db.collection(collection);
  const startTime = Date.now();

  if (dryRun) {
    return {
      result: null,
      metadata: {
        executionTimeMs: 0,
        operation,
        collection,
        dryRun: true,
        message: "Dry run - query not executed",
      },
    };
  }

  // Add timeout to options
  const safeOptions = {
    ...options,
    maxTimeMS: QUERY_TIMEOUT,
  };

  let result: any;
  let affectedDocuments: number | undefined;

  try {
    switch (operation) {
      case "find": {
        const cursor = coll
          .find(query.filter || {}, safeOptions)
          .limit(MAX_RESULT_SIZE);
        result = await cursor.toArray();
        console.log("[MongoDB Result Preview]", JSON.stringify(result.slice(0, 3), null, 2));
        affectedDocuments = result.length;
        break;
      }

      case "aggregate": {
        const pipeline = Array.isArray(query) ? query : [query];
        // Add $limit to pipeline if not present
        const hasLimit = pipeline.some((stage: any) => stage.$limit);
        if (!hasLimit) {
          pipeline.push({ $limit: MAX_RESULT_SIZE });
        }
        const cursor = coll.aggregate(pipeline, safeOptions);
        result = await cursor.toArray();
        affectedDocuments = result.length;
        break;
      }

      case "insertOne": {
        if (!query.document || typeof query.document !== "object") {
          throw new Error("insertOne requires a valid 'document' object");
        }
        result = await coll.insertOne(query.document);
        affectedDocuments = result.acknowledged ? 1 : 0;
        break;
      }

      case "insertMany": {
        if (!Array.isArray(query.documents) || query.documents.length === 0) {
          throw new Error("insertMany requires a non-empty 'documents' array");
        }
        result = await coll.insertMany(query.documents);
        affectedDocuments = result.insertedCount;
        break;
      }

      case "updateOne": {
        if (!query.filter || !query.update) {
          throw new Error("updateOne requires both 'filter' and 'update'");
        }
        result = await coll.updateOne(query.filter, query.update, safeOptions);
        affectedDocuments = result.modifiedCount;
        break;
      }

      case "updateMany": {
        if (!query.filter || !query.update) {
          throw new Error("updateMany requires both 'filter' and 'update'");
        }
        result = await coll.updateMany(query.filter, query.update, safeOptions);
        affectedDocuments = result.modifiedCount;
        break;
      }

      case "deleteOne": {
        if (!query.filter) {
          throw new Error("deleteOne requires a 'filter'");
        }
        result = await coll.deleteOne(query.filter, safeOptions);
        affectedDocuments = result.deletedCount;
        break;
      }

      case "deleteMany": {
        if (!query.filter) {
          throw new Error("deleteMany requires a 'filter'");
        }
        result = await coll.deleteMany(query.filter, safeOptions);
        affectedDocuments = result.deletedCount;
        break;
      }

      case "countDocuments": {
        result = await coll.countDocuments(query.filter || {}, safeOptions);
        affectedDocuments = result;
        break;
      }

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (err: any) {
    if (err instanceof MongoServerError) {
      if (err.code === 50) {
        // MaxTimeMSExpired
        throw {
          code: ErrorCode.TIMEOUT_ERROR,
          message: `Query exceeded maximum execution time of ${QUERY_TIMEOUT}ms`,
          statusCode: 504,
        };
      }
      throw {
        code: ErrorCode.QUERY_EXECUTION_ERROR,
        message: `MongoDB error (${err.code}): ${err.message}`,
        statusCode: 400,
      };
    }
    throw err;
  }

  const executionTimeMs = Date.now() - startTime;

  // Normalize MongoDB documents
  const normalized = Array.isArray(result) ? normalizeMongoDocs(result) : result;

  return {
    result: normalized,
    metadata: {
      executionTimeMs,
      operation,
      collection,
      affectedDocuments,
    },
  };
}

// Helper function to normalize MongoDB documents
function normalizeMongoDocs(docs: any[]) {
  return docs.map(doc => {
    const newDoc = { ...doc };

    // Convert ObjectId → string
    if (newDoc._id && typeof newDoc._id === "object" && newDoc._id.toString) {
      newDoc._id = newDoc._id.toString();
    }

    // Fix fields incorrectly stored as JSON strings
    for (const key in newDoc) {
      if (
        typeof newDoc[key] === "string" &&
        (newDoc[key].trim().startsWith("{") || newDoc[key].trim().startsWith("["))
      ) {
        try {
          newDoc[key] = JSON.parse(newDoc[key]);
        } catch {
          // ignore if not valid json
        }
      }
    }

    return newDoc;
  });
}

// --- Connection Management ---
async function connectWithRetry(
  connectionString: string,
  maxRetries: number = 2
): Promise<MongoClient> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const client = new MongoClient(connectionString, {
        serverSelectionTimeoutMS: CONNECTION_TIMEOUT,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true,
      });
      await client.connect();
      return client;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw {
    code: ErrorCode.CONNECTION_ERROR,
    message: `Failed to connect after ${maxRetries + 1} attempts: ${lastError?.message}`,
    statusCode: 503,
  };
}

// --- Main API Handler ---
export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  let client: MongoClient | null = null;
  const requestStartTime = Date.now();

  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(req);
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          errorCode: ErrorCode.RATE_LIMIT_ERROR,
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    const rawBody = await req.json();
    const validationResult = RequestBodySchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0]?.message || "Validation error",
          errorCode: ErrorCode.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;
    let { schema, userRequest, connectionString, dryRun } = body;

    // Connect to MongoDB with retry
    client = await connectWithRetry(connectionString);
    const dbInstance = client.db();

    // Infer schema automatically if none provided
    if (!schema || schema.trim() === "" || schema.trim() === "{}") {
      const collections = await dbInstance.listCollections().toArray();
      const inferredSchemas: any = {};
      for (const col of collections) {
        inferredSchemas[col.name] = await inferSchema(dbInstance, col.name);
      }
      schema = JSON.stringify(inferredSchemas, null, 2);
    }

    // Sanitize inputs
    const sanitizedSchema = sanitizeInput(schema);
    const sanitizedRequest = sanitizeInput(userRequest);

    // Check cache for read operations
    const cacheKey = getCacheKey(sanitizedSchema, sanitizedRequest);
    const cachedResult = getFromCache(cacheKey);

    if (cachedResult && !dryRun) {
      console.log(`[MongoDB API] Cache hit for: "${sanitizedRequest.slice(0, 50)}..."`);
      return NextResponse.json({
        success: true,
        result: cachedResult.result,
        generatedQuery: cachedResult.query,
        metadata: {
          ...cachedResult.metadata,
          cached: true,
          totalTimeMs: Date.now() - requestStartTime,
        },
      });
    }

    // Generate query with LLM
    console.log(`[MongoDB API] Generating query for: "${sanitizedRequest.slice(0, 50)}..."`);
    const prompt = await createMongoPrompt(sanitizedSchema, sanitizedRequest);
    const llm = getLing1TLLM();
    const generatedQueryStr = await llm.call(prompt);

    // Parse and validate generated query
    const mongoQuery = parseGeneratedQuery(generatedQueryStr);

    console.log(`[MongoDB API] Generated query:`, {
      operation: mongoQuery.operation,
      collection: mongoQuery.collection,
    });
  

    // Execute query
    const { result, metadata } = await executeMongoOperation(dbInstance, mongoQuery, dryRun);

    const totalTimeMs = Date.now() - requestStartTime;

    // Cache read operations only
    if (!dryRun && ["find", "aggregate", "countDocuments"].includes(mongoQuery.operation)) {
      setCache(cacheKey, { result, query: mongoQuery, metadata });
    }

    console.log(
      `[MongoDB API] Success - ${metadata.operation} on ${metadata.collection} ` +
        `(${totalTimeMs}ms, affected: ${metadata.affectedDocuments})`
    );

    // Convert MongoDB documents → dataset format for analysis tools
    // Only convert array results (find, aggregate) to dataset format
    // Other operations (count, insert, update, delete) return metadata objects
    const dataset = Array.isArray(result) && result.length > 0 
      ? mongoToDataset(result) 
      : null;

    return NextResponse.json({
      success: true,
      result: result.answer, // Always include the raw result
      dataset, // Dataset format for analyze/report/visualize (only for array results)
      generatedQuery: mongoQuery,
      metadata: {
        ...metadata,
        totalTimeMs,
        cached: false,
      },
    });


  } catch (err: any) {
    const totalTimeMs = Date.now() - requestStartTime;

    // Handle custom error format
    const errorCode = err.code || ErrorCode.UNKNOWN_ERROR;
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || "Internal server error";

    console.error(`[MongoDB API] Error (${totalTimeMs}ms):`, {
      code: errorCode,
      message: errorMessage,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
      },
      { status: statusCode }
    );
  } finally {
    if (client) {
      await client.close().catch((err) => {
        console.error("[MongoDB API] Error closing connection:", err);
      });
    }
  }
}