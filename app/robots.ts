import type { MetadataRoute } from "next";
import { SITE_URL, absoluteSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin", "/api/automation"] },
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
