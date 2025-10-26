import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("adsense_access_token")?.value;
    const refreshToken = cookieStore.get("adsense_refresh_token")?.value;

    const isAuthenticated = !!(accessToken || refreshToken);

    return NextResponse.json({
      authenticated: isAuthenticated,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch (error: any) {
    console.error("Error checking AdSense auth status:", error);
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
