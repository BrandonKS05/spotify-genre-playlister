import { NextResponse } from "next/server";
import { api } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// Map UI keys -> Spotify seed genre strings
const SEED_MAP: Record<string, string> = {
  edm: "edm",
  hiphop: "hip-hop",
  pop: "pop",
  rock: "rock",
  rnb: "r-n-b",
  kpop: "k-pop",
};

// Text queries to find playlists if recs are empty
const PLAYLIST_QUERY: Record<string, string> = {
  edm: "edm",
  hiphop: "hip hop",
  pop: "pop",
  rock: "rock",
  rnb: "r&b OR r n b",
  kpop: "k-pop OR kpop",
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
  const key = String(body?.genre || "").toLowerCase();
  const L = Math.min(Math.max(Number(body?.limit ?? 50), 10), 100);
  const name = String(body?.name || "").trim();

  if (!key) return NextResponse.json({ error: "missing_genre" }, { status: 400 });

  try {
    // Who/where
    const me = await api("/me", access);
    const market = me?.country || "US";

    // 1) Ensure we use a valid Spotify seed genre
    const desiredSeed = SEED_MAP[key] || key;
    let seed = desiredSeed;

    try {
      const avail = await api("/recommendations/available-genre-seeds", access);
      const set: Set<string> = new Set((avail?.genres || []).map((s: string) => s.toLowerCase()));
      if (!set.has(seed)) {
        // Attempt a sensible fallback: prefer similar seed present in list
        const candidates = ["edm", "pop", "rock", "hip-hop", "r-n-b", "k-pop"];
        const picked = candidates.find(c => set.has(c));
        if (picked) seed = picked;
      }
    } catch {
      // ignore; we’ll still try with the mapped seed
    }

    // 2) Try recommendations with seed_genres only
    let uris: string[] = [];
    try {
      const params = new URLSearchParams();
      params.set("limit", String(L));
      params.set("market", market);
      params.set("seed_genres", seed);

      // Light tuning (optional)
      if (seed === "edm") {
        params.set("target_energy", "0.75");
        params.set("target_danceability", "0.7");
      } else if (seed === "hip-hop") {
        params.set("target_speechiness", "0.2");
        params.set("target_tempo", "95");
      } else if (seed === "pop") {
        params.set("target_valence", "0.7");
      }

      const rec = await api(`/recommendations?${params.toString()}`, access);
      uris = (rec?.tracks || []).map((t: any) => t?.uri).filter(Boolean);
    } catch {
      // swallow and move to fallback
    }

    // 3) Fallback: search playlists by text → grab tracks → random sample
    if (!uris.length) {
      const q = PLAYLIST_QUERY[key] || key;
      try {
        // Find up to ~10 playlists
        const search = await api(`/search?q=${encodeURIComponent(q)}&type=playlist&limit=10`, access);
        const items: any[] = search?.playlists?.items || [];
        const chosen = shuffle(items.slice()).slice(0, 4);

        const collected: string[] = [];
        for (const pl of chosen) {
          if (!pl?.id) continue;
          const tracks = await api(`/playlists/${pl.id}/tracks?market=${market}&limit=100`, access);
          for (const it of tracks?.items || []) {
            const uri = it?.track?.uri;
            if (uri) collected.push(uri);
            if (collected.length >= 400) break;
          }
          if (collected.length >= 400) break;
        }

        shuffle(collected);
        uris = collected.slice(0, L);
      } catch {
        // ignore; we'll handle empty below
      }
    }

    if (!uris.length) {
      return NextResponse.json(
        { error: "no_tracks", details: `No catalog tracks found for '${key}' (seed tried: '${seed}', market: ${market}).` },
        { status: 404 }
      );
    }

    // 4) Create playlist and add tracks
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: name || `${key.toUpperCase()} • Random Catalog Mix`,
        description: `Random ${key.toUpperCase()} picks from Spotify catalog — ${market}`,
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
