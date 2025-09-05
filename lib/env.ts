export const env = {
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:5173/api/callback",
  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:5173"
};
if (!env.SPOTIFY_CLIENT_ID) console.warn("Missing SPOTIFY_CLIENT_ID");
if (!env.SPOTIFY_CLIENT_SECRET) console.warn("Missing SPOTIFY_CLIENT_SECRET");
