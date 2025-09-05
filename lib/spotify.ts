// lib/spotify.ts
import { env } from "./env";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const API_BASE = "https://api.spotify.com/v1";

// ✅ Added "user-top-read" so we can call /me/top/tracks
export const scopes = [
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-email",
  "user-read-private",
  "user-top-read"
].join(" ");

export function authUrl(state: string) {
  const u = new URL(AUTHORIZE_ENDPOINT);
  u.searchParams.set("client_id", env.SPOTIFY_CLIENT_ID);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", env.SPOTIFY_REDIRECT_URI);
  u.searchParams.set("scope", scopes);
  u.searchParams.set("state", state);
  u.searchParams.set("show_dialog", "true"); // ✅ force re-consent after scope change
  return u.toString();
}

export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", env.SPOTIFY_REDIRECT_URI);
  const creds = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
    body
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function refreshToken(refresh_token: string) {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh_token);
  const creds = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
    body
  });
  if (!res.ok) throw new Error("Failed to refresh token");
  return res.json();
}

export async function api(path: string, access_token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify API ${path} failed: ${res.status} ${t}`);
  }
  return res.json();
}

// Find first matching artist ID
export async function getArtistId(name: string, access_token: string): Promise<string | null> {
  const q = new URLSearchParams({ q: name, type: "artist", limit: "1" });
  const data = await api(`/search?${q.toString()}`, access_token);
  return data?.artists?.items?.[0]?.id ?? null;
}
