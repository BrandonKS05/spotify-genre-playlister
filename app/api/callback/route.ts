import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../lib/spotify";
import { setTokens } from "../../../lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stored = (await import("next/headers")).cookies().get("oauth_state")?.value;

  if (!code || !state || state !== stored) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  try {
    const token = await exchangeCodeForToken(code);
    setTokens(token.access_token, token.refresh_token);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/?error=auth", req.url));
  }
}
