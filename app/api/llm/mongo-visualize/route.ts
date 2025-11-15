import { NextRequest, NextResponse } from "next/server";
import mongoToDataset from "@/lib/mongoToDataset";


interface LLMConfig {
  apiKey: string;
  model?: string;
  referer?: string;
  title?: string;
}


interface VisualizeRequest {
  documents: unknown[];
  config: LLMConfig;
}


interface PlotlyVisualization {
  id: string;
  title: string;
  description: string;
  plotlySpec: {
    data: unknown[];
    layout: {
      title: string;
      xaxis?: { title: string };
      yaxis?: { title: string };
      hovermode?: string;
      [key: string]: unknown;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: VisualizeRequest = await req.json();
    const { documents, config } = body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: "Documents array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!config?.apiKey || typeof config.apiKey !== "string") {
      return NextResponse.json(
        { error: "Valid API key is required in config" },
        { status: 400 }
      );
    }

    const dataset = mongoToDataset(documents);
    const { rows, schema, sampleRows } = dataset;

    if (rows.length === 0 || schema.fields.length === 0) {
      return NextResponse.json(
        { error: "Dataset contains no usable fields or rows" },
        { status: 400 }
      );
    }

    const schemaSummary = schema.fields
      .map((f) => `- ${f.name}: ${f.type}`)
      .join("\n");

    const totalRecords = rows.length;

    const systemPrompt = `You are a data visualization expert creating accurate and useful charts using Plotly.

Dataset Schema (field: type):
${schemaSummary}

Total Rows: ${totalRecords}

Sample Data:
${JSON.stringify(sampleRows, null, 2)}

Field Cardinality (unique value counts from sample rows):
${schema.fields
  .map((f) => {
    const values = sampleRows.map((r) => r[f.name]);
    const unique = new Set(values.filter((v) => v != null)).size;
    return `- ${f.name}: ${unique} unique values`;
  })
  .join("\n")}

Visualization Rules:
- Use only fields appearing in the schema
- If type = "string" → treat as category
- If type = "number" → treat as numeric
- If type = "date" → treat as time-series
- Do not generate charts using fields whose type is "object" or "mixed"
- Do not guess relationships between fields; infer only from sample data
- If no meaningful visualizations can be made, return an empty array

- Use:
  • Bar chart for category counts
  • Histogram for numeric distributions
  • Line chart for numeric trends over time
  • Scatter plot for numeric correlations

  Strict Field Selection Rules:
- A field is considered CATEGORICAL only if its type is "string" AND it has fewer than 50 unique values in sampleRows.
- A field is NUMERIC only if its type is "number".
- A field is TIME-SERIES only if its type is "date".

When selecting fields:
- Do NOT treat strings with high cardinality (unique values > 50) as categories. Avoid using them.
- Do NOT create charts using array, object, or mixed types.
- Ensure every chart uses the appropriate field type for its axis.

Output Format (strict JSON):
[
  {
    "id": "unique-id",
    "title": "Readable Title",
    "description": "Short explanation",
    "plotlySpec": {
      "data": [...],
      "layout": {
        "title": "Readable Title",
        "hovermode": "closest"
      }
    }
  }
]

Return JSON only. No markdown.`;

    // Call OpenRouter API
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(config.referer && { "HTTP-Referer": config.referer }),
          ...(config.title && { "X-Title": config.title }),
        },
        body: JSON.stringify({
          model: config.model || "meta-llama/llama-4-maverick:free",
          messages: [{ role: "system", content: systemPrompt }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `LLM API error`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No content received from LLM" },
        { status: 500 }
      );
    }

    const cleaned = content.replace(/```json|```/g, "").trim();

    let visualizations: PlotlyVisualization[];
    try {
      visualizations = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      visualizations,
      total: visualizations.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
