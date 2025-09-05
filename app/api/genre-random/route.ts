import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// Map our friendly genre keys to Spotify Browse Category IDs (best-effort)
const CATEGORY_BY_GENRE: Record<string, string> = {
  edm: "edm_dance",
  hiphop: "hiphop",
  pop: "pop",
  rock: "rock",
  rnb: "rnb",
  kpop: "kpop"
};

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const g = String(body?.genre || "").toLowerCase();
  const L = Math.min(Math.max(Number(body?.limit ?? 50), 10), 100);
  const name = String(body?.name || "").trim();

  if (!g) return NextResponse.json({ error: "missing_genre" }, { status: 400 });

  try {
    // Who/where
    const me = await api("/me", access);
    const market = me?.country || "US";

    // 1) Try pure catalog recommendations: seed_genres only
    const params = new URLSearchParams();
    params.set("limit", String(L));
    params.set("market", market);
    params.set("seed_genres", g); // no artist seeds at all → pure catalog
    // light per-genre tuning (optional)
    if (g === "edm") {
      params.set("target_energy", "0.75");
      params.set("target_danceability", "0.7");
    } else if (g === "hiphop") {
      params.set("target_speechiness", "0.2");
      params.set("target_tempo", "95");
    } else if (g === "pop") {
      params.set("target_valence", "0.7");
    }

    let uris: string[] = [];
    try {
      const rec = await api(`/recommendations?${params.toString()}`, access);
      uris = (rec?.tracks || []).map((t: any) => t?.uri).filter(Boolean);
    } catch {
      // swallow and go to fallback
    }

    // 2) Fallback: browse category → take a few playlists → random sample of tracks
    if (!uris.length) {
      const cat = CATEGORY_BY_GENRE[g];
      if (cat) {
        try {
          const pls = await api(`/browse/categories/${cat}/playlists?country=${market}&limit=10`, access);
          const items: any[] = pls?.playlists?.items || [];
          const chosen = shuffle(items).slice(0, 3); // sample a few playlists
          const collected: string[] = [];

          for (const pl of chosen) {
            if (!pl?.id) continue;
            const tracks = await api(`/playlists/${pl.id}/tracks?market=${market}&limit=100`, access);
            for (const it of tracks?.items || []) {
              const uri = it?.track?.uri;
              if (uri) collected.push(uri);
              if (collected.length >= 300) break;
            }
            if (collected.length >= 300) break;
          }

          shuffle(collected);
          uris = collected.slice(0, L);
        } catch {
          // ignore; if still empty we'll 404 below
        }
      }
    }

    if (!uris.length) {
      return NextResponse.json(
        { error: "no_tracks", details: "Could not find random catalog tracks for this genre/market." },
        { status: 404 }
      );
    }

    // Create playlist
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: name || `${g.toUpperCase()} • Random Catalog Mix`,
        description: `Random ${g.toUpperCase()} picks from Spotify catalog — ${market}`,
        public: false
      })
    });

    // Add in chunks of 100
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
