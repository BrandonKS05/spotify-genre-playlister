import { NextResponse } from "next/server";
import { api, getArtistId } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// Curated seed artists per genre
const genreSeeds: Record<string, string[]> = {
  edm: ["ILLENIUM","Dabin","Knock2","Seven Lions","SLANDER"],
  hiphop: ["Kendrick Lamar","J. Cole","Travis Scott","Drake","21 Savage"],
  pop: ["Taylor Swift","Ariana Grande","Dua Lipa","Olivia Rodrigo","The Weeknd"],
  rock: ["Foo Fighters","Red Hot Chili Peppers","Muse","Arctic Monkeys","The Killers"],
  rnb: ["SZA","Frank Ocean","The Weeknd","H.E.R.","Brent Faiyaz"],
  kpop: ["BTS","BLACKPINK","Stray Kids","NewJeans","SEVENTEEN"]
};

async function safeRecommendations(params: URLSearchParams, access: string) {
  // Try call #1 (as-is)
  try {
    return await api(`/recommendations?${params.toString()}`, access);
  } catch (_) {}

  // Try call #2 (genre only)
  const p2 = new URLSearchParams(params);
  p2.delete("seed_artists");
  try {
    return await api(`/recommendations?${p2.toString()}`, access);
  } catch (_) {}

  return null;
}

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { genre, name, limit } = await req.json();
  const g = (genre || "").toLowerCase();

  try {
    // Profile (for id + market)
    const me = await api("/me", access);
    const market = me?.country || "US";

    // Resolve up to 4 artist IDs (we keep 1 slot for genre → total seeds ≤ 5)
    const wanted = (genreSeeds[g] || []).slice(0, 5);
    const ids: string[] = [];
    for (const w of wanted) {
      const id = await getArtistId(w, access);
      if (id) ids.push(id);
      if (ids.length >= 4) break;
    }

    // Build params (always include genre; Spotify requires ≤5 total seeds)
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(Math.max(limit ?? 50, 10), 100)));
    params.set("market", market);
    if (g) params.set("seed_genres", g);
    if (ids.length) params.set("seed_artists", ids.join(",")); // max 4 here

    // Optional: light per-genre tuning
    if (g === "edm") {
      params.set("target_energy", "0.75");
      params.set("target_danceability", "0.7");
    } else if (g === "hiphop") {
      params.set("target_speechiness", "0.2");
      params.set("target_tempo", "95");
    } else if (g === "pop") {
      params.set("target_valence", "0.7");
    }

    // Fetch recommendations with graceful fallback
    let rec = await safeRecommendations(params, access);
    let uris: string[] = (rec?.tracks || []).map((t: any) => t.uri);

    // LAST-RESORT FALLBACK: use artists' top tracks if recs still failed/empty
    if (!uris.length && ids.length) {
      const topUris: string[] = [];
      for (const id of ids) {
        try {
          const top = await api(`/artists/${id}/top-tracks?market=${market}`, access);
          for (const t of top?.tracks || []) {
            if (topUris.length >= (Number(params.get("limit")) || 50)) break;
            topUris.push(t.uri);
          }
        } catch {}
        if (topUris.length >= (Number(params.get("limit")) || 50)) break;
      }
      uris = topUris;
    }

    if (!uris.length) {
      return NextResponse.json({ error: "no_tracks", details: "Could not build recommendations for this seed/market." }, { status: 404 });
    }

    // Create playlist
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: name || `${(g || "mix").toUpperCase()} • Auto Mix`,
        description: `Auto-generated ${(g || "mix").toUpperCase()} playlist for ${me.display_name} — ${market}`,
        public: false
      })
    });

    // Add tracks (chunks of 100)
    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      await api(`/playlists/${created.id}/tracks`, access, {
        method: "POST",
        body: JSON.stringify({ uris: chunk })
      });
    }

    return NextResponse.json({ ok: true, playlist: created, added: uris.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
