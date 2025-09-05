# Spotify Genre Playlister

Create Spotify playlists by genre (e.g., **EDM**) with one click. We seed Spotify Recommendations with curated artists (e.g., Illenium, Dabin, Knock2, Seven Lions, SLANDER) and match your profile market to avoid common 403 errors.

## Quick Start (3 minutes)

1) **Create a Spotify App** → https://developer.spotify.com/dashboard  
   - App name: *Genre Playlister*
   - Redirect URI: `http://localhost:5173/api/callback`

2) **Copy credentials** into `.env.local` at the project root:

```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:5173/api/callback
APP_BASE_URL=http://localhost:5173
```

3) Install & run:

```bash
npm i
npm run dev
```

Open http://localhost:5173 and click **Connect Spotify**.

## What it does

- Auth: Authorization Code flow (secure on server)
- Scopes: `playlist-modify-public`, `playlist-modify-private`, `user-read-email`, `user-read-private`
- Market: Uses your profile `country` to fetch recommendations that exist in your region.
- Seeds: Adds curated seed artists per genre + the selected `seed_genres` to improve track quality.
- Output: Creates a **private playlist** and adds up to 50 recommended tracks (configurable).

## Add more genres

Edit `app/api/create-playlist/route.ts` → `genreSeeds` to customize artists & tuning per genre.
