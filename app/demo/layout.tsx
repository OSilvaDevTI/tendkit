import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live demo",
  description: "The Tendkit support inbox running in your browser: answer tickets, leave notes, assign, link senders to accounts.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
