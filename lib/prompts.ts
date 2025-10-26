
export const mongoPromptTemplate = `
Convert natural language to MongoDB queries (Node.js driver syntax).

DATABASE SCHEMA:
{{schema}}

USER REQUEST:
"{{input}}"

OUTPUT (JSON only, no markdown/text):
{
  "operation": "find|aggregate|insertOne|updateOne|deleteOne|countDocuments",
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

ERRORS (return these if applicable):
{"error": "Field 'xyz' not in schema"}
{"error": "Cannot delete without filter"}
{"error": "Ambiguous: specify collection"}

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

updateMany:
{ "operation": "updateMany", "collection": "products", "query": {
  "filter": {"stock": {"$lt": 10}},
  "update": {"$set": {"status": "low"}}
}}

OPERATORS:
Compare: $gt $gte $lt $lte $eq $ne $in $nin
Logic: $and $or $not
Element: $exists $type
Array: $all $elemMatch $size
Text: $regex (with "$options": "i")
Aggregate: $sum $avg $min $max $count
Date: $year $month $dayOfMonth

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
 * Build prompt with runtime values
 */
export function buildMongoPrompt(
  schema: string, 
  userInput: string,
  options?: {
    currentDate?: string;
    timezone?: string;
  }
): string {
  return mongoPromptTemplate
    .replace('{{schema}}', schema)
    .replace('{{input}}', userInput)
    .replace('{{CURRENT_DATE}}', options?.currentDate || new Date().toISOString())
    .replace('{{USER_TZ}}', options?.timezone || 'UTC');
}

/**
 * Example usage:
 * 
 * const schema = `
 * users: {_id: ObjectId, name: string, email: string, age: number}
 * orders: {userId: ObjectId, amount: number, status: string}
 * `;
 * 
 * const prompt = buildMongoPrompt(schema, "Find users over 25", {
 *   currentDate: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 * 
 * const response = await llm.generate(prompt);
 * const result = JSON.parse(response);
 * // Execute: db.collection(result.collection)[result.operation](result.query)
 */