import { NextRequest, NextResponse } from "next/server";
import { DataProcessor } from "@/lib/dataProcessor";
import { google } from "googleapis";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Get OAuth tokens from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("adsense_access_token")?.value;
    const refreshToken = cookieStore.get("adsense_refresh_token")?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        {
          error: "Not authenticated. Please authenticate with Google first.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/adsense/callback`;

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials missing");
      return NextResponse.json(
        { error: "Google OAuth credentials not configured on server" },
        { status: 500 }
      );
    }

    // Setup OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Handle token refresh automatically
    oauth2Client.on("tokens", async (tokens: any) => {
      if (tokens.access_token) {
        const cookieStore = await cookies();
        cookieStore.set("adsense_access_token", tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 3600,
        });
      }
    });

    // Initialize AdSense API
    const adsense = google.adsense({ version: "v2", auth: oauth2Client });

    // Get AdSense accounts
    const accountsResponse = await adsense.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    if (accounts.length === 0) {
      return NextResponse.json(
        {
          error: "No AdSense accounts found. Make sure your account is active.",
        },
        { status: 404 }
      );
    }

    const accountName = accounts[0].name!;
    console.log(`Fetching data for account: ${accountName}`);

    // Fetch report data for last 90 days
    const report = await adsense.accounts.reports.generate({
      account: accountName,
      dateRange: "LAST_90_DAYS",
      dimensions: ["DATE", "AD_UNIT_NAME", "COUNTRY_NAME"],
      metrics: [
        "CLICKS",
        "IMPRESSIONS",
        "ESTIMATED_EARNINGS",
        "PAGE_VIEWS",
        "AD_REQUESTS",
        "AD_REQUESTS_COVERAGE",
        "PAGE_VIEWS_CTR",
      ],
    });

    const reportRows = report.data.rows || [];

    if (reportRows.length === 0) {
      return NextResponse.json(
        { error: "No AdSense data found for the last 90 days" },
        { status: 404 }
      );
    }

    // Transform report data
    const rows = reportRows.map((row: any) => {
      const cells = row.cells || [];
      const clicks = parseInt(cells[3]?.value || "0");
      const impressions = parseInt(cells[4]?.value || "0");
      const earnings = parseFloat(cells[5]?.value || "0");
      const pageViews = parseInt(cells[6]?.value || "0");
      const adRequests = parseInt(cells[7]?.value || "0");

      return {
        date: cells[0]?.value || "",
        ad_unit: cells[1]?.value || "Unknown",
        country: cells[2]?.value || "Unknown",
        clicks: clicks,
        impressions: impressions,
        earnings: earnings,
        page_views: pageViews,
        ad_requests: adRequests,
        ad_requests_coverage: parseFloat(cells[8]?.value || "0"),
        page_views_ctr: parseFloat(cells[9]?.value || "0"),
        // Calculated metrics
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        rpm: impressions > 0 ? (earnings / impressions) * 1000 : 0,
        earnings_per_click: clicks > 0 ? earnings / clicks : 0,
      };
    });

    console.log(`Successfully fetched ${rows.length} rows of AdSense data`);

    // Create typed dataset
    const dataset = DataProcessor.createDataSet(
      rows,
      "adsense" as any,
      "Google AdSense Data (Last 90 Days)"
    );

    return NextResponse.json({ dataset });
  } catch (error: any) {
    console.error("Error in adsense/fetch API:", error);

    // Handle specific errors
    if (error.code === 401 || error.message?.includes("invalid_grant")) {
      // Clear invalid tokens
      const cookieStore = await cookies();
      cookieStore.delete("adsense_access_token");
      cookieStore.delete("adsense_refresh_token");

      return NextResponse.json(
        {
          error: "Authentication expired. Please authenticate again.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    if (error.code === 403) {
      return NextResponse.json(
        {
          error:
            "Access denied. Make sure the AdSense Management API is enabled and you have granted the necessary permissions.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
