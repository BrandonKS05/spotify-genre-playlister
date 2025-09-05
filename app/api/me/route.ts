import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

export async function GET() {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ loggedIn: false });
  try {
    const me = await api("/me", access);
    return NextResponse.json({ loggedIn: true, me });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
