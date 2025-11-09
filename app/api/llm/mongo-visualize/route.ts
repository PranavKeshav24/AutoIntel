import { NextRequest, NextResponse } from "next/server";
import { flattenDocuments } from "@/lib/flatten";

export async function POST(req: NextRequest) {
  try {
    const { documents, config } = await req.json();

    if (!documents || !config?.apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const flattened = flattenDocuments(documents);
    const sampleData = flattened.slice(0, 15);

    const systemPrompt = `You are a data visualization expert.
Generate 2-4 Vega-Lite visualizations using these records:
${JSON.stringify(sampleData, null, 2)}

Return ONLY a JSON array.`;

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
    const content = data.choices[0]?.message?.content?.replace(/```json|```/g, "");
    const visualizations = JSON.parse(content);

    return NextResponse.json({ visualizations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
