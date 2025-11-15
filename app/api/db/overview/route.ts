import { NextRequest, NextResponse } from "next/server";
import { MongoClient, Db } from "mongodb";

// ============================================================================
// TYPES
// ============================================================================

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface RequestBody {
  connectionString?: string;
  sampleSize?: number;
  includeDocuments?: boolean;
  collectionsFilter?: string[];
  includeStats?: boolean;
  includeFieldStats?: boolean;
  documentProjection?: Record<string, 0 | 1>;
  page?: number;
  pageSize?: number;
  database?: string; 
  databases?: string[]; 
  mode?: "single" | "multi" | "all"; 
  excludeSystemDbs?: boolean; 
 
  globalTimeoutMs?: number; 
  maxDocSizeKB?: number; 
  sort?: Record<string, 1 | -1>; 
  flattenDocuments?: boolean; 
}

interface FieldStatistics {
  type: string[];
  usageFrequency: number; 
  nullPercentage: number;
  uniqueValueCount?: number;
  exampleValues?: JsonValue[]; 
}

interface CollectionStats {
  storageSize: number; 
  totalIndexSize: number; 
  avgDocumentSize: number; 
  storageSizeMB: string;
  totalIndexSizeMB: string;
  avgDocumentSizeKB: string;
}

interface CollectionOverview {
  collectionName: string;
  documentCount: number;
  attributeCount: number;
  attributes: string[];
  schema: Record<string, string[]>;
  fieldStats?: Record<string, FieldStatistics>;
  topDocuments?: Record<string, JsonValue>[];
  indexes?: Array<{ name: string; keys: Record<string, number> }>;
  isEmptyCollection: boolean;
  collectionStats?: CollectionStats;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface DatabaseOverview {
  databaseName: string;
  totalCollections: number;
  collections: CollectionOverview[];
  message?: string;
}

interface ClusterOverview {
  cluster: DatabaseOverview[];
  timestamp: string;
  executionTimeMs: number;
  mode: "single" | "multi" | "all";
  scannedDatabases: number;
}


const CONFIG = {
  DEFAULT_SAMPLE_SIZE: 10,
  MAX_SAMPLE_SIZE: 100,
  MIN_SAMPLE_SIZE: 1,
  CONNECTION_TIMEOUT: 10000,
  OPERATION_TIMEOUT: 30000,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
  MAX_UNIQUE_VALUES: 1000, 
  FIELD_STATS_SAMPLE_SIZE: 100, 
  DEFAULT_GLOBAL_TIMEOUT: 120000, 
  MAX_GLOBAL_TIMEOUT: 300000, 
  DEFAULT_MAX_DOC_SIZE_KB: 1024, 
  MAX_DOC_SIZE_KB: 10240, 
};


function inferType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array (empty)";
    const elementTypes = new Set(value.map(inferType));
    return `array<${Array.from(elementTypes).join(" | ")}>`;
  }
  if (typeof value === "object") return "object";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value;
}


function validateSampleSize(size?: number): number {
  if (size === undefined) return CONFIG.DEFAULT_SAMPLE_SIZE;

  const parsed = Number(size);

  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    throw new Error("Sample size must be an integer");
  }

  if (parsed < CONFIG.MIN_SAMPLE_SIZE) {
    return CONFIG.MIN_SAMPLE_SIZE;
  }

  if (parsed > CONFIG.MAX_SAMPLE_SIZE) {
    return CONFIG.MAX_SAMPLE_SIZE;
  }

  return parsed;
}


function flattenObject(
  obj: Record<string, JsonValue>,
  prefix: string = ""
): Record<string, JsonValue> {
  const flattened: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null) {
      flattened[newKey] = null;
    } else if (Array.isArray(value)) {
    
      flattened[newKey] = value;
    } else if (typeof value === "object") {
      
      Object.assign(
        flattened,
        flattenObject(value as Record<string, JsonValue>, newKey)
      );
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}


function getDocumentSizeKB(doc: Record<string, JsonValue>): number {
  try {
    const jsonStr = JSON.stringify(doc);
    return new Blob([jsonStr]).size / 1024;
  } catch {
    return 0;
  }
}

function validateGlobalTimeout(timeout?: number): number {
  if (timeout === undefined) return CONFIG.DEFAULT_GLOBAL_TIMEOUT;

  const parsed = Number(timeout);

  if (isNaN(parsed) || parsed <= 0) {
    return CONFIG.DEFAULT_GLOBAL_TIMEOUT;
  }

  if (parsed > CONFIG.MAX_GLOBAL_TIMEOUT) {
    return CONFIG.MAX_GLOBAL_TIMEOUT;
  }

  return parsed;
}


function validateMaxDocSize(size?: number): number {
  if (size === undefined) return CONFIG.DEFAULT_MAX_DOC_SIZE_KB;

  const parsed = Number(size);

  if (isNaN(parsed) || parsed <= 0) {
    return CONFIG.DEFAULT_MAX_DOC_SIZE_KB;
  }

  if (parsed > CONFIG.MAX_DOC_SIZE_KB) {
    return CONFIG.MAX_DOC_SIZE_KB;
  }

  return parsed;
}
function extractDatabaseFromConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const dbName = url.pathname.replace("/", "").split("?")[0];
    return dbName || "test"; 
  } catch {
    return "test"; 
  }
}


function filterSystemDatabases(databases: string[]): string[] {
  const systemDbs = ["admin", "local", "config"];
  return databases.filter((db) => !systemDbs.includes(db));
}
function validatePagination(page?: number, pageSize?: number) {
  const validPage = Math.max(1, Number(page) || 1);
  let validPageSize = Number(pageSize) || CONFIG.DEFAULT_PAGE_SIZE;

  if (validPageSize > CONFIG.MAX_PAGE_SIZE) {
    validPageSize = CONFIG.MAX_PAGE_SIZE;
  }

  return { page: validPage, pageSize: validPageSize };
}


function sanitizeDocument(
  doc: Record<string, JsonValue>
): Record<string, JsonValue> {
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "accessToken",
    "refreshToken",
  ];
  const sanitized = { ...doc };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}


function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}


function calculateFieldStats(
  sampleDocs: Array<Record<string, JsonValue>>,
  totalDocs: number
): Record<string, FieldStatistics> {
  const fieldData: Record<
    string,
    {
      types: Set<string>;
      count: number;
      nullCount: number;
      values: Set<string>;
    }
  > = {};


  for (const doc of sampleDocs) {
    for (const [key, value] of Object.entries(doc)) {
      if (!fieldData[key]) {
        fieldData[key] = {
          types: new Set(),
          count: 0,
          nullCount: 0,
          values: new Set(),
        };
      }

      fieldData[key].count++;
      fieldData[key].types.add(inferType(value));

      if (value === null) {
        fieldData[key].nullCount++;
      }

      
      if (fieldData[key].values.size < CONFIG.MAX_UNIQUE_VALUES) {
        try {
          const stringValue = JSON.stringify(value);
          if (stringValue.length < 200) {
           
            fieldData[key].values.add(stringValue);
          }
        } catch {
          
        }
      }
    }
  }

  
  const stats: Record<string, FieldStatistics> = {};

  for (const [field, data] of Object.entries(fieldData)) {
    const usageFrequency = (data.count / sampleDocs.length) * 100;
    const nullPercentage = (data.nullCount / data.count) * 100;

    stats[field] = {
      type: Array.from(data.types),
      usageFrequency: Math.round(usageFrequency * 100) / 100,
      nullPercentage: Math.round(nullPercentage * 100) / 100,
    };

    if (data.values.size < CONFIG.MAX_UNIQUE_VALUES) {
      stats[field].uniqueValueCount = data.values.size;
    }

    if (data.values.size > 0) {
      const examples = Array.from(data.values).slice(0, 5);
      stats[field].exampleValues = examples.map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    }
  }

  return stats;
}


async function getCollectionStats(
  db: Db,
  collectionName: string
): Promise<CollectionStats | null> {
  try {
    const stats = await db.command({ collStats: collectionName });

    return {
      storageSize: stats.storageSize || 0,
      totalIndexSize: stats.totalIndexSize || 0,
      avgDocumentSize: stats.avgObjSize || 0,
      storageSizeMB: formatBytes(stats.storageSize || 0),
      totalIndexSizeMB: formatBytes(stats.totalIndexSize || 0),
      avgDocumentSizeKB: formatBytes(stats.avgObjSize || 0),
    };
  } catch (error) {
    console.warn(`Failed to get stats for ${collectionName}:`, error);
    return null;
  }
}


async function analyzeCollection(
  db: Db,
  collectionName: string,
  options: {
    sampleSize: number;
    includeDocuments: boolean;
    includeStats: boolean;
    includeFieldStats: boolean;
    documentProjection?: Record<string, 0 | 1>;
    page: number;
    pageSize: number;
    maxDocSizeKB: number;
    sort?: Record<string, 1 | -1>;
    flattenDocuments: boolean;
  },
  signal?: AbortSignal
): Promise<CollectionOverview> {
  const collection = db.collection(collectionName);

  const documentCount = await collection.countDocuments();

  const isEmptyCollection = documentCount === 0;

  if (isEmptyCollection) {
    return {
      collectionName,
      documentCount: 0,
      attributeCount: 0,
      attributes: [],
      schema: {},
      isEmptyCollection: true,
      indexes: await collection
        .listIndexes()
        .toArray()
        .then((indexes) =>
          indexes.map((idx) => ({
            name: idx.name,
            keys: idx.key,
          }))
        ),
    };
  }

  const schemaSampleSize = Math.min(
    options.sampleSize,
    CONFIG.FIELD_STATS_SAMPLE_SIZE
  );
  const sampleDocs = await collection
    .find({})
    .limit(schemaSampleSize)
    .toArray();

  const fieldTypes: Record<string, Set<string>> = {};

  for (const doc of sampleDocs) {
    const docToAnalyze = options.flattenDocuments
      ? flattenObject(doc as Record<string, JsonValue>)
      : (doc as Record<string, JsonValue>);

    for (const [key, value] of Object.entries(docToAnalyze)) {
      if (!fieldTypes[key]) {
        fieldTypes[key] = new Set();
      }
      fieldTypes[key].add(inferType(value));
    }
  }

  const schema = Object.fromEntries(
    Object.entries(fieldTypes).map(([field, types]) => [
      field,
      Array.from(types),
    ])
  );

  const indexes = await collection.listIndexes().toArray();
  const indexInfo = indexes.map((idx) => ({
    name: idx.name,
    keys: idx.key,
  }));

  const attributes = Object.keys(schema);

  const overview: CollectionOverview = {
    collectionName,
    documentCount,
    attributeCount: attributes.length,
    attributes,
    schema,
    indexes: indexInfo,
    isEmptyCollection: false,
  };

  if (options.includeFieldStats) {
    const docsForStats = options.flattenDocuments
      ? sampleDocs.map((doc) => flattenObject(doc as Record<string, JsonValue>))
      : (sampleDocs as Array<Record<string, JsonValue>>);

    overview.fieldStats = calculateFieldStats(docsForStats, documentCount);
  }

  if (options.includeStats) {
    overview.collectionStats =
      (await getCollectionStats(db, collectionName)) || undefined;
  }

  if (options.includeDocuments) {
    const skip = (options.page - 1) * options.pageSize;
    const totalPages = Math.ceil(documentCount / options.pageSize);

    let query = options.documentProjection
      ? collection.find({}, { projection: options.documentProjection })
      : collection.find({});

    if (options.sort) {
      query = query.sort(options.sort);
    }

    const documents = await query.skip(skip).limit(options.pageSize).toArray();

    const processedDocs: Record<string, JsonValue>[] = [];
    let skippedDocs = 0;

    for (const doc of documents) {
      const docRecord = doc as Record<string, JsonValue>;
      const docSizeKB = getDocumentSizeKB(docRecord);

      if (docSizeKB > options.maxDocSizeKB) {
        skippedDocs++;
        console.warn(
          `Skipped large document in ${collectionName}: ${docSizeKB.toFixed(
            2
          )}KB (limit: ${options.maxDocSizeKB}KB)`
        );
        continue;
      }

      let processedDoc = sanitizeDocument(docRecord);

      if (options.flattenDocuments) {
        processedDoc = flattenObject(processedDoc);
      }

      processedDocs.push(processedDoc);
    }

    overview.topDocuments = processedDocs;

    overview.pagination = {
      currentPage: options.page,
      pageSize: options.pageSize,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1,
    };

    if (skippedDocs > 0) {
      (
        overview as any
      ).warning = `${skippedDocs} document(s) skipped due to size limit (${options.maxDocSizeKB}KB)`;
    }
  }

  return overview;
}



export async function POST(request: NextRequest) {
  let client: MongoClient | undefined;
  const startTime = Date.now();

  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const body: RequestBody = await request.json();

    const sampleSize = validateSampleSize(body.sampleSize);
    const includeDocuments = body.includeDocuments ?? false;
    const includeStats = body.includeStats ?? false;
    const includeFieldStats = body.includeFieldStats ?? false;
    const collectionsFilter = body.collectionsFilter;
    const documentProjection = body.documentProjection;
    const excludeSystemDbs = body.excludeSystemDbs ?? true;
    const globalTimeoutMs = validateGlobalTimeout(body.globalTimeoutMs);
    const maxDocSizeKB = validateMaxDocSize(body.maxDocSizeKB);
    const sort = body.sort;
    const flattenDocuments = body.flattenDocuments ?? false;
    const { page, pageSize } = validatePagination(body.page, body.pageSize);

    timeoutId = setTimeout(() => {
      console.warn(
        `Global timeout reached (${globalTimeoutMs}ms), aborting scan...`
      );
      controller.abort();
    }, globalTimeoutMs);

    const connectionString = body.connectionString || process.env.MONGODB_URI;


    if (!connectionString) {
      return NextResponse.json(
        {
          error: "MongoDB connection string not configured",
          details: "Please set MONGODB_URI environment variable",
        },
        { status: 500 }
      );
    }

    if (controller.signal.aborted) {
      throw new Error("Request aborted before connection");
    }

    client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: CONFIG.CONNECTION_TIMEOUT,
      socketTimeoutMS: CONFIG.OPERATION_TIMEOUT,
    });

    await client.connect();
    const admin = client.db().admin();

 

    let selectedDatabases: string[] = [];
    let scanMode: "single" | "multi" | "all" = "single";

    if (body.mode === "all") {
      scanMode = "all";
      const dbList = await admin.listDatabases();
      selectedDatabases = dbList.databases.map((db) => db.name);

      if (excludeSystemDbs) {
        selectedDatabases = filterSystemDatabases(selectedDatabases);
      }
    }
    else if (
      body.databases &&
      Array.isArray(body.databases) &&
      body.databases.length > 0
    ) {
      scanMode = "multi";
      selectedDatabases = body.databases.filter(
        (db) => typeof db === "string" && db.trim().length > 0
      );

      if (selectedDatabases.length === 0) {
        return NextResponse.json(
          {
            error: "Invalid databases array",
            details: "Provide at least one valid database name",
          },
          { status: 400 }
        );
      }
    }
    else if (body.database && typeof body.database === "string") {
      scanMode = "single";
      selectedDatabases = [body.database.trim()];
    }
    else {
      scanMode = "single";
      const defaultDb = extractDatabaseFromConnectionString(connectionString);
      selectedDatabases = [defaultDb];
    }

    if (selectedDatabases.length === 0) {
      return NextResponse.json(
        {
          error: "No databases to scan",
          details: "No valid databases found or specified",
        },
        { status: 400 }
      );
    }



    const clusterOverview: DatabaseOverview[] = [];
    let abortedDueToTimeout = false;

    for (const dbName of selectedDatabases) {
      if (controller.signal.aborted) {
        abortedDueToTimeout = true;
        console.warn(`Scan aborted at database: ${dbName}`);
        break;
      }

      try {
        const db = client.db(dbName);

        const allCollections = await db.listCollections().toArray();

        const collectionsToAnalyze = collectionsFilter
          ? allCollections.filter((col) => collectionsFilter.includes(col.name))
          : allCollections;

        if (collectionsToAnalyze.length === 0) {
          clusterOverview.push({
            databaseName: dbName,
            totalCollections: allCollections.length,
            collections: [],
            message: collectionsFilter
              ? "No matching collections found with the specified filter"
              : "Database has no collections",
          });
          continue;
        }

        const collectionSummaries: CollectionOverview[] = [];

        for (const { name } of collectionsToAnalyze) {
          if (controller.signal.aborted) {
            abortedDueToTimeout = true;
            break;
          }

          try {
            const collectionInfo = await analyzeCollection(
              db,
              name,
              {
                sampleSize,
                includeDocuments,
                includeStats,
                includeFieldStats,
                documentProjection,
                page,
                pageSize,
                maxDocSizeKB,
                sort,
                flattenDocuments,
              },
              controller.signal
            );
            collectionSummaries.push(collectionInfo);
          } catch (collectionError) {
            if (controller.signal.aborted) {
              abortedDueToTimeout = true;
              break;
            }

            console.error(
              `Error analyzing ${dbName}.${name}:`,
              collectionError
            );
            collectionSummaries.push({
              collectionName: name,
              documentCount: 0,
              attributeCount: 0,
              attributes: [],
              schema: {},
              isEmptyCollection: true,
            });
          }
        }

        clusterOverview.push({
          databaseName: dbName,
          totalCollections: allCollections.length,
          collections: collectionSummaries,
        });
      } catch (dbError) {
        if (controller.signal.aborted) {
          abortedDueToTimeout = true;
          break;
        }

        console.error(`Error accessing database ${dbName}:`, dbError);
        clusterOverview.push({
          databaseName: dbName,
          totalCollections: 0,
          collections: [],
          message: `Failed to access database: ${
            dbError instanceof Error ? dbError.message : "Unknown error"
          }`,
        });
      }
    }

    const executionTimeMs = Date.now() - startTime;

    const response: ClusterOverview = {
      cluster: clusterOverview,
      timestamp: new Date().toISOString(),
      executionTimeMs,
      mode: scanMode,
      scannedDatabases: clusterOverview.length,
    };

    if (abortedDueToTimeout) {
      (
        response as any
      ).warning = `Scan aborted due to global timeout (${globalTimeoutMs}ms). Partial results returned.`;
    }

    console.log(
      `Cluster overview completed in ${executionTimeMs}ms (${scanMode} mode, ${
        selectedDatabases.length
      } databases)${abortedDueToTimeout ? " [ABORTED]" : ""}`
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Error in /api/db/overview:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isConnectionError =
      errorMessage.includes("connection") || errorMessage.includes("timeout");
    const isAbortError =
      errorMessage.includes("aborted") || controller.signal.aborted;

    return NextResponse.json(
      {
        error: isAbortError
          ? "Request timed out"
          : "Failed to fetch database overview",
        details: errorMessage,
        type: isAbortError
          ? "timeout_error"
          : isConnectionError
          ? "connection_error"
          : "processing_error",
      },
      { status: isAbortError ? 408 : isConnectionError ? 503 : 500 }
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (client) {
      try {
        await client.close();
        console.log("MongoDB connection closed successfully");
      } catch (closeError) {
        console.warn("Failed to close MongoDB client:", closeError);
      }
    }
  }
}



export async function GET() {
  return NextResponse.json({
    message: "MongoDB Multi-Database Explorer API",
    version: "5.0.0 - Enterprise Edition",
    features: [
      " Multi-database scanning (single/multi/all modes)",
      " Schema inference with type detection",
      " Empty collection detection",
      " Storage statistics (size, indexes, avg document size)",
      " Field-level statistics (usage frequency, null %, unique values, examples)",
      " Document pagination with sorting",
      " Field projection (exclude large fields)",
      " Sensitive data redaction",
      " Per-collection error handling",
      " System database filtering (admin/local/config)",
      "⏱ Global timeout protection",
      " Document size filtering",
      " Document flattening for LLM integration",
    ],
    scanModes: {
      single: "Scan one database (default or specified)",
      multi: "Scan multiple specific databases",
      all: "Scan all databases in the cluster",
    },
    endpoints: {
      POST: {
        description:
          "Analyze MongoDB database(s) structure with enterprise features",
        body: {
          database: "string (optional) - Single database name",
          databases: "string[] (optional) - Array of database names",
          mode: "'single' | 'multi' | 'all' (optional) - Scanning mode",
          excludeSystemDbs:
            "boolean (default: true) - Filter out admin/local/config in 'all' mode",

          sampleSize:
            "number (1-100, default: 10) - Sample size for schema inference",
          includeDocuments:
            "boolean (default: false) - Include actual documents",
          includeStats: "boolean (default: false) - Include storage statistics",
          includeFieldStats:
            "boolean (default: false) - Include field-level statistics",
          collectionsFilter:
            "string[] (optional) - Only analyze specific collections",
          documentProjection:
            "object (optional) - Fields to include/exclude, e.g., { largeField: 0 }",

          page: "number (default: 1) - Page number for document pagination",
          pageSize: "number (default: 10, max: 50) - Documents per page",
          sort: "object (optional) - Sort documents, e.g., { createdAt: -1, name: 1 }",

          globalTimeoutMs: `number (default: ${CONFIG.DEFAULT_GLOBAL_TIMEOUT}, max: ${CONFIG.MAX_GLOBAL_TIMEOUT}) - Global timeout for entire scan`,
          maxDocSizeKB: `number (default: ${CONFIG.DEFAULT_MAX_DOC_SIZE_KB}, max: ${CONFIG.MAX_DOC_SIZE_KB}) - Max document size to include`,
          flattenDocuments:
            "boolean (default: false) - Flatten nested objects (e.g., address.city → address_city)",
        },
        examples: {
          "Quick scan": {
            sampleSize: 20,
          },
          "Single database with stats": {
            database: "production_users",
            includeStats: true,
            includeFieldStats: true,
          },
          "Multiple databases": {
            databases: ["users_db", "orders_db", "analytics_db"],
            includeStats: true,
            sampleSize: 50,
          },
          "All databases (enterprise scan)": {
            mode: "all",
            excludeSystemDbs: true,
            includeStats: true,
            globalTimeoutMs: 180000,
          },
          "LLM-optimized (flattened + sorted)": {
            database: "myapp",
            includeDocuments: true,
            flattenDocuments: true,
            sort: { createdAt: -1 },
            maxDocSizeKB: 512,
            page: 1,
            pageSize: 20,
          },
          "Full enterprise analysis": {
            mode: "all",
            sampleSize: 100,
            includeDocuments: true,
            includeStats: true,
            includeFieldStats: true,
            documentProjection: { largeImageField: 0, binaryData: 0 },
            sort: { _id: -1 },
            maxDocSizeKB: 1024,
            globalTimeoutMs: 240000,
            flattenDocuments: false,
            page: 1,
            pageSize: 20,
          },
        },
      },
    },
    configuration: {
      maxSampleSize: CONFIG.MAX_SAMPLE_SIZE,
      maxPageSize: CONFIG.MAX_PAGE_SIZE,
      connectionTimeout: `${CONFIG.CONNECTION_TIMEOUT}ms`,
      operationTimeout: `${CONFIG.OPERATION_TIMEOUT}ms`,
      defaultGlobalTimeout: `${CONFIG.DEFAULT_GLOBAL_TIMEOUT}ms`,
      maxGlobalTimeout: `${CONFIG.MAX_GLOBAL_TIMEOUT}ms`,
      defaultMaxDocSize: `${CONFIG.DEFAULT_MAX_DOC_SIZE_KB}KB`,
      maxDocSize: `${CONFIG.MAX_DOC_SIZE_KB}KB`,
    },
    responseStructure: {
      cluster: "DatabaseOverview[] - Array of database analyses",
      timestamp: "string - ISO timestamp",
      executionTimeMs: "number - Total execution time",
      mode: "string - Scan mode used",
      scannedDatabases: "number - Count of databases analyzed",
      warning: "string (optional) - Present if scan was aborted or had issues",
    },
    useCases: {
      dataDiscovery: "Explore unknown MongoDB clusters",
      llmIntegration: "Flatten and prepare data for AI/LLM processing",
      migration: "Analyze schemas before migrating databases",
      monitoring: "Track database growth and structure changes",
      compliance: "Audit data structures and sensitive fields",
    },
  });
}
