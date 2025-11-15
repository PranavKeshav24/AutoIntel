import { NextRequest, NextResponse } from "next/server";
import { Settings } from "llamaindex";
import {
  OpenAIChatLLM,
  buildMongoIndex,
  queryMongoData,
} from "@/lib/llama/index";

interface QueryRequest {
  connectionString?: string;
  question?: string;
  sessionId?: string;
  apiKey?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      connectionString,
      question,
      sessionId,
      apiKey,
      model,
    }: QueryRequest = await request.json();

    if (!connectionString || typeof connectionString !== "string") {
      return NextResponse.json(
        { error: "Missing MongoDB connection string" },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing natural-language question" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "Missing OpenRouter API key" },
        { status: 400 }
      );
    }

    Settings.llm = new OpenAIChatLLM({
      apiKey,
      model: model || process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const index = await buildMongoIndex(connectionString);
    const answer = await queryMongoData(index, question);

    return NextResponse.json({
      answer,
      sessionId: sessionId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/query:", error);
    return NextResponse.json(
      { error: "Query failed", details: message },
      { status: 500 }
    );
  }
}
