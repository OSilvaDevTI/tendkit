import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/site/header";
import { SITE_URL } from "@/site/config";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

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

// Follows the visitor's system theme, before paint.
const themeScript = `try{var m=matchMedia("(prefers-color-scheme: dark)");var s=function(){document.documentElement.classList.toggle("dark",m.matches)};s();m.addEventListener("change",s)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-svh flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
