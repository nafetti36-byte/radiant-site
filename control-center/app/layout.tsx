import "./globals.css";
import type { Metadata } from "next";
import { getLang } from "@/lib/context.ts";
import { isRtl } from "@/lib/i18n.ts";

export const metadata: Metadata = { title: "Marketing Control Center", robots: { index: false, follow: false } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
