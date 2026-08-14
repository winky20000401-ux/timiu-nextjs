export const SITE_URL = "https://timiu.com";

export function absoluteSiteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}
