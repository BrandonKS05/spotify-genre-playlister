import { NextResponse } from "next/server";
import { api, getArtistId } from "../../../lib/spotify";
import { getTokens } from "../../../lib/session";

// Curated seed artists per genre for better recommendations
const genreSeeds: Record<string, string[]> = {
  edm: ["ILLENIUM","Dabin","Knock2","Seven Lions","SLANDER"],
  hiphop: ["Kendrick Lamar","J. Cole","Travis Scott","Drake","21 Savage"],
  pop: ["Taylor Swift","Ariana Grande","Dua Lipa","Olivia Rodrigo","The Weeknd"],
  rock: ["Foo Fighters","Red Hot Chili Peppers","Muse","Arctic Monkeys","The Killers"],
  rnb: ["SZA","Frank Ocean","The Weeknd","H.E.R.","Brent Faiyaz"],
  kpop: ["BTS","BLACKPINK","Stray Kids","NewJeans","SEVENTEEN"]
};

export async function POST(req: Request) {
  const { access } = getTokens();
  if (!access) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const { genre, name, limit } = await req.json();
  const g = (genre || "").toLowerCase();

  try {
    // Profile (for user id + market)
    const me = await api("/me", access);
    const market = me?.country || "US";

    // Resolve up to 5 seed artist IDs
    const wanted = (genreSeeds[g] || []).slice(0, 5);
    const ids: string[] = [];
    for (const w of wanted) {
      const id = await getArtistId(w, access);
      if (id) ids.push(id);
    }

    // Build recommendations
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(Math.max(limit ?? 50, 10), 100)));
    params.set("market", market);
    if (ids.length) params.set("seed_artists", ids.join(","));
    params.set("seed_genres", g);

    // Light per-genre tuning
    if (g === "edm") {
      params.set("target_energy", "0.75");
      params.set("target_danceability", "0.7");
    } else if (g === "hiphop") {
      params.set("target_speechiness", "0.2");
      params.set("target_tempo", "95");
    } else if (g === "pop") {
      params.set("target_valence", "0.7");
    }

    const rec = await api(`/recommendations?${params.toString()}`, access);
    const uris = (rec.tracks || []).map((t: any) => t.uri);

    // Create playlist
    const created = await api(`/users/${me.id}/playlists`, access, {
      method: "POST",
      body: JSON.stringify({
        name: name || `${g.toUpperCase()} • Auto Mix`,
        description: `Auto-generated ${g.toUpperCase()} playlist for ${me.display_name} — ${market}`,
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
