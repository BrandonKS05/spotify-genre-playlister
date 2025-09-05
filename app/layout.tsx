import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Genre Playlister",
  description: "Create Spotify playlists by genre with one click",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
