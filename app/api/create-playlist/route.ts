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

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}

async function tryRecs(params: URLSearchParams, access: string) {
  // attempt as-is
  try { return await api(`/recommendations?${params.toString()}`, access); } catch {}
  // retry genre-only
  const p2 = new URLSearchParams(params);
  p2.delete("seed_artists");
  try { return await api(`/recommendations?${p2.toString()}`, access); } catch {}
  return null;
}

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { genre, name, limit } = await req.json();
  const g = (genre || "").toLowerCase();

  try {
    // who/where
    const me = await api("/me", access);
    const market = me?.country || "US";

    // resolve up to 4 unique artist IDs (keep 1 slot for genre, total seeds ≤ 5)
    const wanted = (genreSeeds[g] || []).slice(0, 6);
    const ids: string[] = [];
    for (const w of wanted) {
      const id = await getArtistId(w, access);
      if (id) ids.push(id);
      if (ids.length >= 4) break;
    }
    const artistSeeds = uniq(ids).slice(0, 4);

    // build params — ALWAYS include genre
    const params = new URLSearchParams();
    const L = Math.min(Math.max(Number(limit ?? 50), 10), 100);
    params.set("limit", String(L));
    params.set("market", market);
    if (g) params.set("seed_genres", g);
    if (artistSeeds.length) params.set("seed_artists", artistSeeds.join(","));

    // optional tuning
    if (g === "edm") {
      params.set("target_energy", "0.75");
      params.set("target_danceability", "0.7");
    } else if (g === "hiphop") {
      params.set("target_speechiness", "0.2");
      params.set("target_tempo", "95");
    } else if (g === "pop") {
      params.set("target_valence", "0.7");
    }

    // recommendations with graceful fallbacks
    let rec = await tryRecs(params, access);
    let uris: string[] = (rec?.tracks || []).map((t: any) => t.uri);

    // last resort: artists' top tracks
    if (!uris.length && artistSeeds.length) {
      const topUris: string[] = [];
      for (const id of artistSeeds) {
        try {
          const top = await api(`/artists/${id}/top-tracks?market=${market}`, access);
          for (const t of top?.tracks || []) {
            if (topUris.length >= L) break;
            topUris.push(t.uri);
          }
        } catch {}
        if (topUris.length >= L) break;
      }
      uris = topUris;
    }

    if (!uris.length) {
      return NextResponse.json(
        { error: "no_tracks", details: "No recommendations for this seed/market." },
        { status: 404 }
      );
    }

    // create playlist
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: name || `${(g || "mix").toUpperCase()} • Auto Mix`,
        description: `Auto-generated ${(g || "mix").toUpperCase()} playlist for ${me.display_name} — ${market}`,
        public: false
      })
    });

    // add tracks (chunks of 100)
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
