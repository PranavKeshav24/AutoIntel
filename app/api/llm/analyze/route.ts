import { NextRequest, NextResponse } from "next/server";
import { DataSet, LLMAnalysisResponse, VisualizationSpec } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { dataset, query, config } = await request.json();

    if (!dataset || !query || !config?.apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare dataset summary for LLM
    const schemaSummary = dataset.schema.fields
      .map(
        (f: any) => `- ${f.name} (${f.type})${f.nullable ? " [nullable]" : ""}`
      )
      .join("\n");

    const sampleData = dataset.schema.sampleRows || dataset.rows.slice(0, 5);

    const systemPrompt = `You are a data analysis assistant.
The dataset is provided as JSON data and may have either a flat tabular structure (like CSV/Excel/SQL) or a nested document structure (like MongoDB).

Dataset schema (fields and their inferred data types):
${schemaSummary}

Total records: ${dataset.schema.rowCount}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Your task is to:
1. Determine whether the dataset is flat (row/column) or nested (document-oriented)
2. Identify key fields and their significance, then summarize meaningful insights
3. Answer the user's question based on the available data
4. Suggest visualizations using Vega-Lite when helpful (prioritize numeric trends, distributions, or categorical comparisons)
5. Provide 3 relevant follow-up questions to help explore the data further

Respond in **JSON ONLY**, formatted exactly as follows:
{
  "answer": "Your analysis here.",
  "visualizations": [
    {
      "id": "unique-id",
      "title": "Chart title",
      "description": "What insight the chart provides",
      "vegaLiteSpec": { /* valid Vega-Lite spec */ }
    }
  ],
  "followUps": ["Question 1?", "Question 2?", "Question 3?"]
}

CRITICAL: Return ONLY the raw JSON object. No markdown code blocks (no \`\`\`json), no backticks, no preamble, no text outside the JSON structure.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ];

    // Call OpenRouter API
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.referer || "https://your-app.com",
          "X-Title": config.title || "Data Analysis App",
        },
        body: JSON.stringify({
          model: config.model || "openai/gpt-oss-20b:free",
          messages,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ||
      content.match(/```\s*([\s\S]*?)```/) || [null, content];

    let parsed: any = {};
    try {
      parsed = JSON.parse(jsonMatch[1] || content);
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        answer: content,
        visualizations: [],
        followUps: [],
      };
    }

    const result: LLMAnalysisResponse = {
      answer: parsed.answer || content,
      visualizations: parsed.visualizations || [],
      followUps: parsed.followUps || [],
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in LLM analyze API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
