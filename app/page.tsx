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

  const createGenre = async (genre: string) => {
    setStatus(`Creating your ${genre.toUpperCase()} playlist…`);
    setError("");
    try {
      const res = await fetch("/api/create-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus(`✅ Added ${data.added} tracks and created: ${data.playlist.name}`);
    } catch (e:any) {
      setStatus("");
      setError(String(e?.message || "Something went wrong"));
    }
  };

  const createTopTracks = async () => {
    setStatus(`Building your Top Tracks playlist…`);
    setError("");
    try {
      const res = await fetch("/api/top-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: "short_term", limit: 50 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus(`✅ Added ${data.added} tracks and created: ${data.playlist.name}`);
    } catch (e:any) {
      setStatus("");
      setError(String(e?.message || "Something went wrong"));
    }
  };

  const createTrending = async () => {
    setStatus(`Building Trending Now (Global Top 50)…`);
    setError("");
    try {
      const res = await fetch("/api/trending", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const topOne = data?.topTrack?.name ? ` Top track: ${data.topTrack.name} — ${data.topTrack?.artists?.[0]?.name ?? ""}` : "";
      setStatus(`✅ Added ${data.added} tracks and created: ${data.playlist.name}.${topOne}`);
    } catch (e:any) {
      setStatus("");
      setError(String(e?.message || "Something went wrong"));
    }
  };

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
            <p className="muted">Connect Spotify, pick a genre or use the shortcuts (Top Tracks / Trending), and we’ll build playlists on your account.</p>
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

            <p><b>Select a genre:</b></p>
            <div className="grid">
              {GENRES.map(g => (
                <button key={g.key} className="genre" onClick={() => createGenre(g.key)}>
                  {g.label}
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
