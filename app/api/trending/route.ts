import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

export const dynamic = "force-dynamic";

// A few well-known Spotify editorial playlists to try first.
// (IDs can vary by region/time; we fall back to search if these fail.)
const CANDIDATE_PLAYLIST_IDS = [
  "37i9dQZEVXbMDoHDwVN2tF", // Top 50 - Global (classic)
  "37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
  "37i9dQZEVXbNG2KDcFcKOF", // Top 50 - USA (as a fallback snapshot)
];

async function tryPlaylist(id: string, market: string, access: string, limit: number) {
  try {
    const res = await api(`/playlists/${id}/tracks?market=${market}&limit=${limit}`, access);
    const items = res?.items || [];
    const uris = items.map((it: any) => it?.track?.uri).filter(Boolean);
    if (uris.length) return { uris, items };
  } catch {
    // ignore and try next candidate
  }
  return null;
}

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const L = Math.min(Math.max(Number(body?.limit ?? 50), 1), 50);

  try {
    const me = await api("/me", access);
    const market = me?.country || "US";

    // 1) Try known editorial IDs
    let chosen: { uris: string[]; items: any[] } | null = null;
    for (const id of CANDIDATE_PLAYLIST_IDS) {
      const got = await tryPlaylist(id, market, access, L);
      if (got && got.uris.length) { chosen = got; break; }
    }

    // 2) Fallback: search for “Top 50 Global” playlists and pick a Spotify-owned one
    if (!chosen) {
      try {
        const search = await api(`/search?q=${encodeURIComponent("Top 50 Global")}&type=playlist&limit=10`, access);
        const items: any[] = search?.playlists?.items || [];
        // prefer owner.id === "spotify" or display_name contains "Spotify"
        const ranked = items.sort((a, b) => {
          const aOwner = (a?.owner?.id || a?.owner?.display_name || "").toLowerCase();
          const bOwner = (b?.owner?.id || b?.owner?.display_name || "").toLowerCase();
          const aScore = aOwner.includes("spotify") ? 1 : 0;
          const bScore = bOwner.includes("spotify") ? 1 : 0;
          return bScore - aScore;
        });

        for (const pl of ranked) {
          if (!pl?.id) continue;
          const got = await tryPlaylist(pl.id, market, access, L);
          if (got && got.uris.length) { chosen = got; break; }
        }
      } catch {
        // ignore; we'll error if still nothing
      }
    }

    if (!chosen) {
      return NextResponse.json(
        { error: "no_tracks", details: "Could not locate a Top/Trending editorial playlist for your market." },
        { status: 404 }
      );
    }

    const uris = chosen.uris;

    // Create a snapshot playlist for the user
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: body?.name || "Trending Now — Global/Editorial",
        description: `Editorial Top/Trending snapshot for ${me.display_name} — ${market}`,
        public: false
      })
    });

    for (let i = 0; i < uris.length; i += 100) {
      await api(`/playlists/${created.id}/tracks`, access, {
        method: "POST",
        body: JSON.stringify({ uris: uris.slice(i, i + 100) })
      });
    }

    const topTrack = chosen.items?.[0]?.track ?? null;
    return NextResponse.json({ ok: true, playlist: created, added: uris.length, topTrack });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
