import { NextRequest, NextResponse } from "next/server";
import { flattenDocuments } from "@/lib/flatten";

/**
 * Configuration for LLM API calls
 */
interface LLMConfig {
  apiKey: string;
  model?: string;
  referer?: string;
  title?: string;
}

/**
 * Request body structure
 */
interface VisualizeRequest {
  documents: unknown[];
  config: LLMConfig;
}

/**
 * Plotly visualization specification
 */
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
      [key: string]: unknown;
    };
  };
}

/**
 * Generates Plotly visualizations from MongoDB documents using LLM.
 * 
 * @param req - Next.js request object containing documents and LLM config
 * @returns JSON response with array of Plotly visualization specifications
 */
export async function POST(req: NextRequest) {
  try {
    const body: VisualizeRequest = await req.json();
    const { documents, config } = body;

    // Input validation
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

    // Flatten documents to handle nested structures
    const flattened = flattenDocuments(documents);
    
    if (flattened.length === 0) {
      return NextResponse.json(
        { error: "No valid data found after flattening documents" },
        { status: 400 }
      );
    }

    // Extract schema from first document (all flattened docs should have same structure)
    const firstDoc = flattened[0] || {};
    const fields = Object.keys(firstDoc);
    
    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields found in documents" },
        { status: 400 }
      );
    }

    // Create schema summary
    const schemaSummary = fields.map((field) => `- ${field}`).join("\n");
    
    // Get sample data for context (limit to prevent prompt size issues)
    const sampleData = flattened.slice(0, 15);
    const totalRecords = flattened.length;

    // Build system prompt
    const systemPrompt = `You are a data visualization expert creating interactive visualizations using Plotly.

The dataset is in JSON form and may contain nested fields (e.g., user.name). If a field is nested, reference it as "parent.child".

Dataset Schema:
${schemaSummary}

Total Records: ${totalRecords}

Sample Data (to infer field roles and types):
${JSON.stringify(sampleData, null, 2)}

Your task is to create **2-4 meaningful visualizations** that reveal insights from the data.

Visualization Rules:
- **Use ONLY fields that appear in the schema or sampleData**
- For categorical distributions → use bar charts
- For numeric trends → use line or area charts
- For relationships between two numeric fields → use scatter plots
- For group comparisons → grouped bar charts
- For distributions → use histograms
- Always include:
  * Clear title
  * Axis labels
  * Tooltip enabled (hovermode: 'closest' in layout)

Technical Requirements:
- Output **Plotly JSON specifications**
- Use this JSON format exactly:

[
  {
    "id": "unique-chart-id",
    "title": "Chart Title",
    "description": "Brief explanation of insight",
    "plotlySpec": {
      "data": [
        {
          "type": "bar",
          "x": ["FieldA"],
          "y": ["FieldB"]
        }
      ],
      "layout": {
        "title": "Chart Title",
        "xaxis": { "title": "X Axis Label" },
        "yaxis": { "title": "Y Axis Label" },
        "hovermode": "closest"
      }
    }
  }
]

CRITICAL OUTPUT RULES:
- Return **raw JSON array only** — no backticks, no markdown
- Do NOT add text before or after JSON
- Ensure JSON is valid and parseable
- Each visualization must have a unique "id" field
- All field references must exist in the schema above`;

    // Call OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(config.referer && { "HTTP-Referer": config.referer }),
        ...(config.title && { "X-Title": config.title }),
      },
      body: JSON.stringify({
        model: config.model || "openai/gpt-oss-20b:free",
        messages: [{ role: "system", content: systemPrompt }],
      }),
    });

    // Check if API call was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return NextResponse.json(
        { 
          error: `LLM API error: ${response.status} ${response.statusText}`,
          details: errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract content from response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json(
        { error: "No content received from LLM" },
        { status: 500 }
      );
    }

    // Clean content (remove markdown code blocks)
    const cleanedContent = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Parse JSON with error handling
    let visualizations: PlotlyVisualization[];
    try {
      visualizations = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content received:", cleanedContent.substring(0, 500));
      return NextResponse.json(
        { 
          error: "Failed to parse LLM response as JSON",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error"
        },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!Array.isArray(visualizations)) {
      return NextResponse.json(
        { error: "LLM response must be an array of visualizations" },
        { status: 500 }
      );
    }

    // Validate each visualization has required fields
    const validatedVisualizations = visualizations.filter((viz) => {
      return (
        viz &&
        typeof viz === "object" &&
        typeof viz.id === "string" &&
        typeof viz.title === "string" &&
        viz.plotlySpec &&
        typeof viz.plotlySpec === "object"
      );
    });

    if (validatedVisualizations.length === 0) {
      return NextResponse.json(
        { error: "No valid visualizations found in LLM response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      visualizations: validatedVisualizations,
      total: validatedVisualizations.length 
    });
  } catch (err) {
    console.error("Error in mongo-visualize API:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
