// app/api/adsense/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      const redirectUrl = new URL("/upload", request.url);
      redirectUrl.searchParams.set("adsense_error", error);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code) {
      const redirectUrl = new URL("/upload", request.url);
      redirectUrl.searchParams.set("adsense_error", "no_code");
      return NextResponse.redirect(redirectUrl);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/adsense/callback`;

    console.log("Callback - Base URL:", baseUrl);
    console.log("Callback - Redirect URI:", redirectUri);

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials not configured");
      const redirectUrl = new URL("/upload", request.url);
      redirectUrl.searchParams.set("adsense_error", "config_error");
      return NextResponse.redirect(redirectUrl);
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange authorization code for tokens
    console.log("Exchanging code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);
    console.log("Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    // Create response with redirect
    const redirectUrl = new URL("/upload", request.url);
    redirectUrl.searchParams.set("adsense_auth", "success");
    const response = NextResponse.redirect(redirectUrl);

    // Set cookies on the response
    if (tokens.access_token) {
      const maxAge = tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600; // 1 hour default

      response.cookies.set("adsense_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: maxAge,
        path: "/",
      });

      console.log("Access token cookie set with maxAge:", maxAge);
    }

    if (tokens.refresh_token) {
      response.cookies.set("adsense_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });

      console.log("Refresh token cookie set");
    }

    console.log("Redirecting to:", redirectUrl.toString());
    return response;
  } catch (error: any) {
    console.error("Error in adsense/callback API:", error);
    const redirectUrl = new URL("/upload", request.url);
    redirectUrl.searchParams.set(
      "adsense_error",
      encodeURIComponent(error.message)
    );
    return NextResponse.redirect(redirectUrl);
  }
}
