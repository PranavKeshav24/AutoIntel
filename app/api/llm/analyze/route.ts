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

    const systemPrompt = `You are a data analysis assistant. You have access to a dataset with the following schema:

${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Your task is to:
1. Answer the user's query based on the data
2. Suggest relevant visualizations using Plotly specification, only if the user has asked for it in the query.
3. Provide follow-up questions

Respond in JSON format:
{
  "answer": "Your analysis here",
  "visualizations": [
    {
      "id": "unique-id",
  "title": "Chart Title",
  "description": "What this chart shows",
  "plotlyData": [
    {
      "x": [...],
      "y": [...],
      "type": "bar|scatter|line|pie|box|histogram|heatmap",
      "mode": "lines|markers|lines+markers",
      "name": "Series Name",
      "marker": { "color": "blue" }
    }
  ],
  "plotlyLayout": {
    "xaxis": { "title": "X Axis Label" },
    "yaxis": { "title": "Y Axis Label" },
    "title": "Chart Title"
  }
    }
  ],
  "followUps": ["Question 1?", "Question 2?"]
}`;

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
