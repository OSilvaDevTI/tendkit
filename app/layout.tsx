import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/site/config";
import { themeScript } from "@/site/theme-config";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Offered by the theme picker.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

const description =
  "Turn customer emails, WhatsApp and SMS into tickets your team answers next to the customer's account. Open source: you copy the code into your app, shadcn-style.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Tendkit: customer support you own", template: "%s · Tendkit" },
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "Tendkit: customer support you own", description, url: SITE_URL, siteName: "Tendkit", type: "website" },
  twitter: { card: "summary_large_image", title: "Tendkit: customer support you own", description },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${figtree.variable} ${bricolage.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
