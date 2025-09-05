import { NextResponse } from "next/server";
import { clearTokens } from "../../../lib/session";

export async function GET(req: Request) {
  clearTokens();
  // send you straight into the OAuth flow again
  return NextResponse.redirect(new URL("/api/login", req.url));
}
