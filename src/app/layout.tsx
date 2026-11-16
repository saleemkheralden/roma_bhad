import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { strings } from "@/lib/strings";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: { default: strings.app.name, template: `%s · ${strings.app.name}` },
  description: strings.app.description,
  applicationName: strings.app.name,
  appleWebApp: { capable: true, title: strings.app.shortName },
  // Private course tool: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The board navy, so the phone's status bar continues the board band.
  themeColor: "#0e1b33",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
