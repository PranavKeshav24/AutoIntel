import { NextRequest, NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";

export async function POST(request: NextRequest) {
  try {
    const { subreddit } = await request.json();

    if (!subreddit || typeof subreddit !== "string") {
      return NextResponse.json(
        { error: "Invalid subreddit name" },
        { status: 400 }
      );
    }

    // Fetch from Reddit JSON API (no authentication needed for public data)
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=100`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DataAnalysisPlatform/1.0",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Subreddit not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch Reddit data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    // Transform Reddit posts to structured data
    const rows = posts.map((post: any) => ({
      id: post.data.id,
      title: post.data.title,
      author: post.data.author,
      score: post.data.score,
      num_comments: post.data.num_comments,
      created_utc: new Date(post.data.created_utc * 1000),
      upvote_ratio: post.data.upvote_ratio,
      url: post.data.url,
      selftext: post.data.selftext?.substring(0, 500) || null, // Truncate long text
      subreddit: post.data.subreddit,
      is_video: post.data.is_video,
      over_18: post.data.over_18,
      spoiler: post.data.spoiler,
      stickied: post.data.stickied,
    }));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No posts found in this subreddit" },
        { status: 400 }
      );
    }

    // Create typed dataset
    const dataset = DataProcessor.createDataSet(
      rows,
      "reddit" as any,
      `r/${subreddit}`
    );

    return NextResponse.json({ dataset });
  } catch (error: any) {
    console.error("Error in reddit/fetch API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
