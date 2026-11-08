import type { MetadataRoute } from "next";
import { SITE_URL } from "@/site/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/demo", "/docs", "/docs/channels"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
