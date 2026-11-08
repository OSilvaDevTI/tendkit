import type { Metadata } from "next";

// The app inside the demo's preview frame. Not a page of its own.
export const metadata: Metadata = { title: "Demo app", robots: { index: false, follow: false } };

export default function FrameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
