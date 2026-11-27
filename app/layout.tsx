import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../components/pastoral/refinement.css";
import "./pastoral.css";
import "./brand45.css";
import "../components/app/page-spacing.css";
import "../components/app/action-controls.css";
import { SessionHeartbeat } from "../components/auth/SessionHeartbeat";
import { AppInstallProvider } from "../components/app/AppInstall";
import { COMMUNITY_2027 } from "../src/content/community-2027";

export const metadata: Metadata = {
  title: {
    default: "삼덕사오",
    template: "%s | 삼덕사오",
  },
  description: `${COMMUNITY_2027.year}년 45공동체 · ${COMMUNITY_2027.motto}. ${COMMUNITY_2027.intro}`,
  applicationName: "삼덕사오",
  appleWebApp: { capable: true, title: "삼덕사오", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/45-logo-v5-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/45-logo-v5-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/45-logo-v5-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><SessionHeartbeat /><AppInstallProvider>{children}</AppInstallProvider></body>
    </html>
  );
}
