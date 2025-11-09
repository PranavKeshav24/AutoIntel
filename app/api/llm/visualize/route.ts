import { NextRequest, NextResponse } from "next/server";
import { DataSet, VisualizationSpec } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { dataset, config } = await request.json();

    if (!dataset || !config?.apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const schemaSummary = dataset.schema.fields
      .map((f: any) => `- ${f.name} (${f.type})`)
      .join("\n");

    const sampleData = dataset.schema.sampleRows || dataset.rows.slice(0, 10);

    const systemPrompt = `You are a data visualization expert. Analyze this dataset and suggest 4 relevant visualizations.

Dataset Schema:
${schemaSummary}

Total rows: ${dataset.schema.rowCount}

Sample data:
${JSON.stringify(sampleData, null, 2)}

Create 4 diverse visualizations (bar, line, pie, scatter, etc.) that best represent the data patterns.

Respond with a JSON array of visualization specs:
[
  {
    "id": "viz-1",
    "title": "Chart Title",
    "description": "What this chart shows",
    "vegaLiteSpec": {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "data": { "values": [] },
      "mark": "bar",
      "encoding": {
        "x": {"field": "fieldName", "type": "nominal"},
        "y": {"field": "fieldName", "type": "quantitative"}
      },
      "width": 400,
      "height": 300
    }
  }
]

IMPORTANT: Include actual data samples in the "values" array, not empty arrays.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: "Suggest the best 4 visualizations for this dataset",
      },
    ];

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

    // Extract JSON array
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)```/) ||
      content.match(/```\s*([\s\S]*?)```/) ||
      content.match(/\[[\s\S]*\]/);

    let visualizations: VisualizationSpec[] = [];
    try {
      visualizations = JSON.parse(
        jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
      );
    } catch (e) {
      console.error("Failed to parse visualizations:", e);
      visualizations = [];
    }

    return NextResponse.json({ visualizations });
  } catch (error: any) {
    console.error("Error in LLM visualize API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
