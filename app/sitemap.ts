import type { MetadataRoute } from "next";
import { SITE_URL } from "@/site/config";
import { ALL_PAGES } from "@/site/docs/nav";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/demo", ...ALL_PAGES.map((p) => p.href)].map((path) => ({ url: `${SITE_URL}${path}` }));
}
