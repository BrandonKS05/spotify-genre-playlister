'use client';

import { useEffect, useState } from "react";

type Me = {
  display_name: string;
  images?: { url: string }[];
  id: string;
  country?: string;
};

const GENRES = [
  { key: "edm", label: "EDM" },
  { key: "hiphop", label: "Hip-Hop" },
  { key: "pop", label: "Pop" },
  { key: "rock", label: "Rock" },
  { key: "rnb", label: "R&B" },
  { key: "kpop", label: "K-Pop" },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      const data = await res.json();
      setLoggedIn(data.loggedIn);
      if (data.loggedIn) setMe(data.me);
    })();
  }, []);

  const run = async (path: string, body: any, labelForStatus: string) => {
    setStatus(labelForStatus);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus(`✅ Added ${data.added} tracks and created: ${data.playlist.name}`);
    } catch (e:any) {
      setStatus("");
      setError(String(e?.message || "Something went wrong"));
    }
  };

  const createPersonalized = (genre: string) =>
    run("/api/create-playlist", { genre }, `Creating your ${genre.toUpperCase()} playlist (personalized)…`);

  const createRandomGenre = (genre: string) =>
    run("/api/genre-random", { genre }, `Creating random ${genre.toUpperCase()} mix from catalog…`);

  const createTopTracks = () =>
    run("/api/top-tracks", { range: "short_term", limit: 50 }, "Building your Top Tracks playlist…");

  const createTrending = () =>
    run("/api/trending", {}, "Building Trending Now (Global Top 50)…");

  return (
    <div className="container">
      <div className="header">
        <div className="flex">
          <div className="tag">Genre Playlister</div>
        </div>
        <div className="flex">
          {!loggedIn ? (
            <a className="btn" href="/api/login">Connect Spotify</a>
          ) : (
            <a className="btn secondary" href="https://open.spotify.com/" target="_blank" rel="noreferrer">Open Spotify</a>
          )}
        </div>
      </div>

      <div className="card">
        {!loggedIn ? (
          <>
            <h1>One-click Spotify playlists</h1>
            <p className="muted">Connect Spotify, then build playlists by genre (personalized) or as random catalog mixes. Also try shortcuts for your Top Tracks and Global Trending.</p>
            <hr/>
            <a className="btn" href="/api/login">Connect Spotify</a>
          </>
        ) : (
          <>
            <div className="flex" style={{justifyContent:'space-between'}}>
              <div className="flex">
                {me?.images?.[0]?.url && <img src={me.images[0].url} alt="avatar" width={38} height={38} style={{borderRadius:12}}/>}
                <div>
                  <div>Hi, {me?.display_name || me?.id} 👋</div>
                  <div className="small muted">Market: {me?.country || "US"}</div>
                </div>
              </div>
              <a className="btn" href="/api/login">Switch account</a>
            </div>

            <hr/>
            <p><b>Personalized by genre (uses your taste + catalog):</b></p>
            <div className="grid">
              {GENRES.map(g => (
                <button key={g.key} className="genre" onClick={() => createPersonalized(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>

            <hr/>
            <p><b>Random from catalog (ignores your library):</b></p>
            <div className="grid">
              {GENRES.map(g => (
                <button key={g.key} className="genre" onClick={() => createRandomGenre(g.key)}>
                  Random {g.label}
                </button>
              ))}
            </div>

            <hr/>
            <p><b>Shortcuts:</b></p>
            <div className="grid">
              <button className="genre" onClick={createTopTracks}>My Most Played (last 4 weeks)</button>
              <button className="genre" onClick={createTrending}>Trending Now (Global Top 50)</button>
            </div>

            <hr/>
            {status && <div className="success">{status}</div>}
            {error && <div className="error">{error}</div>}
            <p className="muted small">Playlists are private by default. You can rename or make them public later in Spotify.</p>
          </>
        )}
      </div>
    </div>
  );
}
