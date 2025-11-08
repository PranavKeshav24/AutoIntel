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

    const systemPrompt = `You are a data visualization expert creating insightful charts using Vega-Lite.

The dataset has been provided as JSON and may be:
- Flat/tabular (CSV, Excel, SQL-like), or
- Nested/document-oriented (MongoDB, API JSON)

Dataset Schema (field names and inferred data types):
${schemaSummary}

Total Records: ${dataset.schema.rowCount}

Sample Data (use this to understand structure and infer field types):
${JSON.stringify(sampleData, null, 2)}

Your task is to create **2-4 meaningful visualizations** that reveal insights from the data.

Visualization Guidelines:
- **Use ONLY fields that exist in the schema/sample data** — do not invent fields
- If a field is nested (e.g., {"user": {"name": "Sam"}}), you may reference it as "user.name"
- Choose visualizations appropriate for the data type:
  * Categorical data → bar charts, pie charts, grouped bars
  * Numeric data → histograms, line charts, scatter plots, area charts
  * Time-series → line or area charts with temporal encoding
  * Comparisons → bar charts, grouped/stacked bars
  * Distributions → histograms, box plots
  * Relationships → scatter plots, heatmaps
- Prioritize charts that show trends, patterns, distributions, or key comparisons
- Each chart should answer a specific analytical question

Technical Requirements:
- Use valid **Vega-Lite v5** specifications
- Each visualization MUST include actual data in "data": { "values": [...] }
- Use 5-20 representative sample records per chart
- Use correct encoding types: "nominal", "ordinal", "quantitative", "temporal"
- Include clear axis labels, descriptive titles, and enable tooltips
- Set reasonable dimensions (width: 400-600, height: 300-400)
- Apply aggregation (count, sum, average, etc.) only when it adds analytical value
- Do NOT use empty data arrays or external data URLs

Respond with a **JSON array** formatted exactly as:
[
  {
    "id": "unique-chart-id",
    "title": "Clear, concise chart title",
    "description": "Brief explanation of what insight this chart reveals",
    "vegaLiteSpec": {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "description": "Chart description",
      "data": { "values": [ /* 5-20 actual data records */ ] },
      "mark": { "type": "bar", "tooltip": true },
      "encoding": {
        "x": { 
          "field": "actualFieldName", 
          "type": "nominal",
          "axis": { "title": "Descriptive X Label" }
        },
        "y": { 
          "field": "actualFieldName", 
          "type": "quantitative",
          "axis": { "title": "Descriptive Y Label" }
        }
      },
      "width": 500,
      "height": 350
    }
  }
]

CRITICAL OUTPUT REQUIREMENTS:
- Return **raw JSON array only** — no preamble, explanation, or commentary
- Do NOT wrap in markdown code blocks (\`\`\`json) or backticks
- Do NOT include any text outside the JSON structure
- Ensure the JSON is valid and parseable`;

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
