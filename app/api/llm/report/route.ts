import { NextRequest, NextResponse } from "next/server";
import { DataSet, LLMReportResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { dataset, query, config } = await request.json();

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

    const reportQuery =
      query || "Generate a comprehensive analytical report of this dataset";

    const systemPrompt = `You are a professional data analyst generating a polished analytical report.

The dataset has been converted to JSON format and may originate from:
- Flat/Tabular sources (CSV, Excel, SQL outputs, PDF table extractions)
- Nested/Document sources (MongoDB collections, JSON API responses)

The data may therefore be:
- Flat (row/column, relational), or
- Nested (hierarchical document structures)

Dataset Schema (field names and inferred types):
${schemaSummary}

Total Records: ${dataset.schema.rowCount}

Sample Data (context reference only, do not repeat it verbatim):
${JSON.stringify(sampleData, null, 2)}

Your task is to produce a structured analytical report that includes:

1. **Executive Summary** - overview and key insights
2. **Data Structure & Source Characteristics** - identify whether the data is flat or nested, describe key fields and their roles
3. **Key Findings & Patterns** - highlight meaningful trends, correlations, distributions, or outliers
4. **Statistical / Descriptive Analysis** - counts, averages, frequency distributions (only when applicable and visible in data)
5. **Trends / Relationships** - describe any indications of relationships between fields (only what is supported by data)
6. **Recommendations** - suggest insights or next steps based on findings

Formatting Rules:
- **CRITICAL**: Use only fields that actually appear in the schema or sample data. Do not invent business meaning that is not present.
- **DO NOT include any charts, graphs, or visualizations.** This is a textual analytical report only. Visualizations belong to the analytical exploration endpoint, not here.
- Write in clear, professional business language.
- Return clean HTML content with embedded CSS for professional styling (semantic headings, paragraphs, tables, lists).
- Do NOT use markdown, code blocks, or backticks. Return **pure HTML content only** (no <!DOCTYPE> or <html> wrapper, as that will be added automatically).`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: reportQuery },
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
    let htmlContent = data.choices[0]?.message?.content || "";

    // Remove markdown code blocks if present
    htmlContent = htmlContent
      .replace(/```html\s*/g, "")
      .replace(/```\s*$/g, "");

    // Wrap in basic HTML structure if not present
    if (!htmlContent.includes("<!DOCTYPE") && !htmlContent.includes("<html")) {
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #3498db; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
    }

    const result: LLMReportResponse = {
      htmlMarkdown: htmlContent,
      metadata: {
        generatedAt: new Date().toISOString(),
        rowsAnalyzed: dataset.schema.rowCount,
      },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in LLM report API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
