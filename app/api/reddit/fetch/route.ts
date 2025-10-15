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

    // Clean subreddit name
    const cleanSubreddit = subreddit.replace(/^r\//, "").trim();

    // Fetch from Reddit JSON API with better headers
    const url = `https://www.reddit.com/r/${cleanSubreddit}/hot.json?limit=100`;

    const response = await fetch(url, {
      headers: {
        // More realistic User-Agent
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      // Add cache configuration to potentially help with rate limiting
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error(
        `Reddit API error: ${response.status} ${response.statusText}`
      );

      if (response.status === 404) {
        return NextResponse.json(
          { error: "Subreddit not found" },
          { status: 404 }
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          {
            error:
              "Reddit blocked the request. This may happen due to rate limiting or IP restrictions. Try using Reddit API credentials or wait a few minutes.",
            suggestion:
              "Consider using Reddit's official API with authentication for production use.",
          },
          { status: 403 }
        );
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limited by Reddit. Please try again in a few minutes.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch Reddit data: ${response.statusText}` },
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
      selftext: post.data.selftext?.substring(0, 500) || null,
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
      `r/${cleanSubreddit}`
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
