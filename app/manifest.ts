import type { MetadataRoute } from "next";
import { COMMUNITY_2027 } from "../src/content/community-2027";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "삼덕사오",
    short_name: "삼덕사오",
    description: `${COMMUNITY_2027.year}년 45공동체 · ${COMMUNITY_2027.motto}. ${COMMUNITY_2027.intro}`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/45-logo-v3-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/45-logo-v3-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/45-logo-v3-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
