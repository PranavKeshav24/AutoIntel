import { NextRequest, NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditAccessToken() {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Reddit credentials not configured. Please set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables."
    );
  }

  // Get access token using client credentials flow
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "web:reddit-data-fetcher:v1.0.0",
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Reddit OAuth error:", errorText);
    throw new Error("Failed to authenticate with Reddit API");
  }

  const tokenData = await tokenResponse.json();

  // Cache the token (typically valid for 1 hour, we'll cache for 50 minutes)
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return tokenData.access_token;
}

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

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getRedditAccessToken();
    } catch (authError: any) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // Fetch from Reddit OAuth API with pagination
    const allPosts: any[] = [];
    let after: string | null = null;
    const maxPages = 10; // Fetch up to 1000 posts (10 pages * 100 per page)

    for (let page = 0; page < maxPages; page++) {
      const url = `https://oauth.reddit.com/r/${cleanSubreddit}/hot?limit=100${
        after ? `&after=${after}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "web:reddit-data-fetcher:v1.0.0",
        },
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
                "Access forbidden. The subreddit may be private or restricted.",
            },
            { status: 403 }
          );
        }

        if (response.status === 429) {
          return NextResponse.json(
            {
              error:
                "Rate limited by Reddit. Please try again in a few minutes.",
            },
            { status: 429 }
          );
        }

        if (response.status === 401) {
          // Clear cached token and retry once
          cachedToken = null;
          return NextResponse.json(
            {
              error:
                "Authentication failed. Please check your Reddit API credentials.",
            },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: `Failed to fetch Reddit data: ${response.statusText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const posts = data.data?.children || [];

      if (posts.length === 0) break;

      allPosts.push(...posts);
      after = data.data?.after;

      // If there's no more data, break early
      if (!after) break;

      // Add a small delay to be respectful to Reddit's API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const posts = allPosts;

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
