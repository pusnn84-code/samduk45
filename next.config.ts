import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingIncludes: {
    "/scripture/bible/**": ["./data/scripture-library/bible/*.json"],
    "/scripture/reading/**": ["./data/scripture-library/bible/*.json"],
    "/api/scripture/hymn-score/**": ["./data/scripture-library/hymns/*.webp"],
  },
};

export default config;
