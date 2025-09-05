import { NextResponse } from "next/server";
import crypto from "crypto";
import { authUrl } from "@/lib/spotify";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = authUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
