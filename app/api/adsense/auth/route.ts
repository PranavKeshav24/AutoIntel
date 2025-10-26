import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/adsense/callback`;

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials not configured");
      return new NextResponse(
        `
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>Google OAuth credentials are not configured. Please set up:</p>
            <ul>
              <li>GOOGLE_CLIENT_ID</li>
              <li>GOOGLE_CLIENT_SECRET</li>
              <li>NEXT_PUBLIC_BASE_URL</li>
            </ul>
            <a href="/">Go back</a>
          </body>
        </html>
        `,
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate auth URL with AdSense scope
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Get refresh token
      scope: ["https://www.googleapis.com/auth/adsense.readonly"],
      prompt: "consent", // Force consent screen to ensure refresh token
      include_granted_scopes: true,
    });

    console.log("Redirecting to Google OAuth:", authUrl);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Error in adsense/auth API:", error);
    return new NextResponse(
      `
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>${error.message}</p>
          <a href="/">Go back</a>
        </body>
      </html>
      `,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
