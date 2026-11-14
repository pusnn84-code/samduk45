// Server-rendered public information. SUPPORT_EMAIL is deliberately not a NEXT_PUBLIC variable.
export const APP_NAME = "삼덕사오";
export const COMMUNITY_NAME = "삼덕교회 45공동체";
export const CONTACT_INSTRUCTION = "45공동체 운영 담당자에게 문의해 주세요.";

type BrandingEnvironment = Record<string, string | undefined>;

export function getBranding(env: BrandingEnvironment = process.env) {
  const configuredUrl = env.PUBLIC_APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  let appOrigin: string | undefined;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash) {
      throw new Error("PUBLIC_APP_URL must be an HTTPS origin without credentials, port, path, query or fragment.");
    }
    appOrigin = url.origin;
  }
  const supportEmail = env.SUPPORT_EMAIL?.trim() || undefined;
  if (supportEmail && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(supportEmail)) {
    throw new Error("SUPPORT_EMAIL must be a valid email address.");
  }
  return { appName: APP_NAME, communityName: COMMUNITY_NAME, appOrigin, supportEmail };
}

export function publicPageMetadata(path: "/about" | "/privacy" | "/2027", env: BrandingEnvironment = process.env) {
  const { appOrigin } = getBranding(env);
  return appOrigin ? { alternates: { canonical: `${appOrigin}${path}` } } : {};
}
