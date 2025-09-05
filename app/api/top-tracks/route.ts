import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// Make sure this file is treated as a module and always runs on Node
export const dynamic = "force-dynamic";

type Range = "short_term" | "medium_term" | "long_term";

// POST body (optional): { range?: "short_term" | "medium_term" | "long_term", limit?: number, name?: string }
export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const range: Range = (body?.range ?? "short_term") as Range; // ~4w, 6m, all-time
  const L = Math.min(Math.max(Number(body?.limit ?? 50), 1), 50);

  try {
    const me = await api("/me", access);
    const market = me?.country || "US";

    const top = await api(`/me/top/tracks?time_range=${range}&limit=${L}`, access);
    const uris: string[] = (top?.items || []).map((t: any) => t.uri);

    if (!uris.length) {
      return NextResponse.json({ error: "no_tracks", details: "No top tracks found for this range." }, { status: 404 });
    }

    const label =
      range === "short_term" ? "Last 4 Weeks" :
      range === "medium_term" ? "Last 6 Months" : "All Time";

    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: body?.name || `Your Top Tracks • ${label}`,
        description: `Auto playlist of your most played tracks — ${label} (${market})`,
        public: false
      })
    });

    for (let i = 0; i < uris.length; i += 100) {
      await api(`/playlists/${created.id}/tracks`, access, {
        method: "POST",
        body: JSON.stringify({ uris: uris.slice(i, i + 100) })
      });
    }

    return NextResponse.json({ ok: true, playlist: created, added: uris.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
