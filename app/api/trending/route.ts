import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// force dynamic so it always runs server-side
export const dynamic = "force-dynamic";

// Spotify editorial playlist ID: Top 50 – Global
const TOP_50_GLOBAL = "37i9dQZEVXbMDoHDwVN2tF";

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const L = Math.min(Math.max(Number(body?.limit ?? 50), 1), 50);

  try {
    const me = await api("/me", access);
    const market = me?.country || "US";

    // Read the editorial playlist and copy its tracks
    const tracks = await api(`/playlists/${TOP_50_GLOBAL}/tracks?market=${market}&limit=${L}`, access);
    const items = tracks?.items || [];
    const uris: string[] = items.map((it: any) => it?.track?.uri).filter(Boolean);

    if (!uris.length) {
      return NextResponse.json({ error: "no_tracks", details: "Could not read Top 50 – Global playlist." }, { status: 404 });
    }

    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: body?.name || "Trending Now — Global Top 50",
        description: `Global Top 50 snapshot for ${me.display_name} — ${market}`,
        public: false
      })
    });

    for (let i = 0; i < uris.length; i += 100) {
      await api(`/playlists/${created.id}/tracks`, access, {
        method: "POST",
        body: JSON.stringify({ uris: uris.slice(i, i + 100) })
      });
    }

    const topTrack = items[0]?.track ?? null;
    return NextResponse.json({ ok: true, playlist: created, added: uris.length, topTrack });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
