import type { NextConfig } from "next";

// A static site: the landing page, docs, the in-browser demo and the shadcn registry (public/r).
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default config;
