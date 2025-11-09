import { NextRequest, NextResponse } from "next/server";
import { flattenDocuments } from "@/lib/flatten";

export async function POST(req: NextRequest) {
  try {
    const { documents, config } = await req.json();

    if (!documents || !config?.apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const flattened = flattenDocuments(documents);
    const sampleData = flattened.slice(0, 10);

    const systemPrompt = `You are a professional data analyst writing a formal HTML report.

Dataset Sample:
${JSON.stringify(sampleData, null, 2)}

Write structured report sections:
- Executive Summary
- Data Overview
- Findings
- Trends
- Recommendations

Return **pure HTML** (no Markdown).`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model || "openai/gpt-oss-20b:free",
        messages: [{ role: "system", content: systemPrompt }],
      }),
    });

    const data = await response.json();
    let html = data.choices[0]?.message?.content || "";
    html = html.replace(/```html|```/g, "");

    return NextResponse.json({ html });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
