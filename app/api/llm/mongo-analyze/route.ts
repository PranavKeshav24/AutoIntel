import { NextRequest, NextResponse } from "next/server";
import { flattenDocuments } from "@/lib/flatten";

export async function POST(req: NextRequest) {
  try {
    const { documents, query, config } = await req.json();

    if (!documents || !Array.isArray(documents) || !config?.apiKey) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const flattened = flattenDocuments(documents);
    const fields = Object.keys(flattened[0] || {});
    const schemaSummary = fields.map((f) => `- ${f}`).join("\n");

    const sampleData = flattened.slice(0, 6);

    const systemPrompt = `You are a MongoDB-aware data analysis assistant. 
The dataset has been flattened from nested documents. 
Fields:
${schemaSummary}

Total records: ${flattened.length}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Your task:
1. Answer the user’s query.
2. Suggest visualizations (Vega-Lite).
3. Provide follow-up questions.

Return JSON ONLY:
{
  "answer": "...",
  "visualizations": [...],
  "followUps": [...]
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model || "openai/gpt-oss-20b:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    const parsed = JSON.parse(content.replace(/```json|```/g, ""));

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
