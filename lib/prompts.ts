/**
 * MongoDB query generation prompt template.
 * 
 * This template is used to convert natural language requests into MongoDB queries.
 * It supports both LangChain PromptTemplate (via {{schema}} and {{input}} variables)
 * and standalone usage (via buildMongoPrompt function).
 */
export const mongoPromptTemplate = `
Convert natural language to MongoDB queries (Node.js driver syntax).

DATABASE SCHEMA:
{{schema}}

USER REQUEST:
"{{input}}"

OUTPUT (JSON only, no markdown/text):
{
  "operation": "find|aggregate|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|countDocuments",
  "collection": "string",
  "query": {}
}

RULES:
1. All fields must exist in schema
2. Never drop/delete without filters  
3. Limit unbounded queries to 100
4. Use {{CURRENT_DATE}} for "today", {{USER_TZ}} for timezone
5. Nested fields: use dot notation ("address.city")
6. Arrays: match values directly or use $elemMatch for objects
7. Always validate collection names against schema

ERRORS (return these if applicable):
{"error": "Field 'xyz' not in schema"}
{"error": "Cannot delete without filter"}
{"error": "Ambiguous: specify collection"}
{"error": "Collection 'xyz' not in schema"}

PATTERNS:

find:
{ "operation": "find", "collection": "users", "query": {
  "filter": {"age": {"$gt": 25}},
  "projection": {"name": 1},
  "options": {"sort": {"name": 1}, "limit": 10, "skip": 0}
}}

aggregate (grouping/joins/calculations):
{ "operation": "aggregate", "collection": "orders", "query": [
  {"$match": {"status": "completed"}},
  {"$group": {"_id": "$userId", "total": {"$sum": "$amount"}}},
  {"$sort": {"total": -1}},
  {"$limit": 5}
]}

lookup (join):
{ "operation": "aggregate", "collection": "orders", "query": [
  {"$lookup": {"from": "users", "localField": "userId", "foreignField": "_id", "as": "user"}},
  {"$unwind": "$user"}
]}

insertOne:
{ "operation": "insertOne", "collection": "users", "query": {
  "document": {"name": "John", "email": "john@test.com"}
}}

insertMany:
{ "operation": "insertMany", "collection": "users", "query": {
  "documents": [{"name": "John"}, {"name": "Jane"}]
}}

updateOne:
{ "operation": "updateOne", "collection": "products", "query": {
  "filter": {"_id": "product123"},
  "update": {"$set": {"status": "active"}}
}}

updateMany:
{ "operation": "updateMany", "collection": "products", "query": {
  "filter": {"stock": {"$lt": 10}},
  "update": {"$set": {"status": "low"}}
}}

deleteOne:
{ "operation": "deleteOne", "collection": "users", "query": {
  "filter": {"_id": "user123"}
}}

deleteMany:
{ "operation": "deleteMany", "collection": "users", "query": {
  "filter": {"status": "inactive"}
}}

countDocuments:
{ "operation": "countDocuments", "collection": "users", "query": {
  "filter": {"age": {"$gte": 18}}
}}

OPERATORS:
Compare: $gt $gte $lt $lte $eq $ne $in $nin
Logic: $and $or $not $nor
Element: $exists $type
Array: $all $elemMatch $size
Text: $regex (with "$options": "i")
Aggregate: $sum $avg $min $max $count $first $last
Date: $year $month $dayOfMonth $dayOfWeek $hour $minute $second

EXAMPLES:

Schema: users: {name: string, age: number, city: string}
Request: "Users over 30 in Boston"
{"operation": "find", "collection": "users", "query": {"filter": {"age": {"$gt": 30}, "city": "Boston"}}}

Schema: orders: {userId: string, amount: number, status: string}
Request: "Average order by status"
{"operation": "aggregate", "collection": "orders", "query": [{"$group": {"_id": "$status", "avg": {"$avg": "$amount"}}}]}

Schema: users: {_id: ObjectId, name: string}, orders: {userId: ObjectId, amount: number}
Request: "Top 3 spenders"
{"operation": "aggregate", "collection": "orders", "query": [{"$group": {"_id": "$userId", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}, {"$limit": 3}, {"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "user"}}, {"$unwind": "$user"}, {"$project": {"name": "$user.name", "total": 1}}]}

Schema: users: {name: string, tags: [string], address: {city: string}}
Request: "Users tagged 'premium' in Boston"
{"operation": "find", "collection": "users", "query": {"filter": {"tags": "premium", "address.city": "Boston"}}}

Generate query. Return JSON only.
`;

/**
 * Options for building MongoDB prompts with runtime values.
 */
export interface BuildMongoPromptOptions {
  /** ISO 8601 date string. Defaults to current date/time. */
  currentDate?: string;
  /** IANA timezone identifier. Defaults to 'UTC'. */
  timezone?: string;
}

/**
 * Builds a MongoDB prompt with runtime values.
 * 
 * Replaces template placeholders with actual values:
 * - {{schema}} → schema parameter
 * - {{input}} → userInput parameter
 * - {{CURRENT_DATE}} → currentDate option or current ISO date
 * - {{USER_TZ}} → timezone option or 'UTC'
 * 
 * @param schema - The database schema description
 * @param userInput - The natural language query request
 * @param options - Optional runtime values for date and timezone
 * @returns The formatted prompt string
 * @throws {Error} If schema or userInput is empty
 * 
 * @example
 * ```typescript
 * const schema = `
 * users: {_id: ObjectId, name: string, email: string, age: number}
 * orders: {userId: ObjectId, amount: number, status: string}
 * `;
 * 
 * const prompt = buildMongoPrompt(schema, "Find users over 25", {
 *   currentDate: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 * ```
 */
export function buildMongoPrompt(
  schema: string,
  userInput: string,
  options?: BuildMongoPromptOptions
): string {
  // Input validation
  if (!schema || typeof schema !== 'string' || !schema.trim()) {
    throw new Error('Schema is required and must be a non-empty string');
  }
  
  if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
    throw new Error('User input is required and must be a non-empty string');
  }

  // Get runtime values with defaults
  const currentDate = options?.currentDate || new Date().toISOString();
  const timezone = options?.timezone || 'UTC';

  // Replace all occurrences of each placeholder using global regex
  return mongoPromptTemplate
    .replace(/\{\{schema\}\}/g, schema.trim())
    .replace(/\{\{input\}\}/g, userInput.trim())
    .replace(/\{\{CURRENT_DATE\}\}/g, currentDate)
    .replace(/\{\{USER_TZ\}\}/g, timezone);
}