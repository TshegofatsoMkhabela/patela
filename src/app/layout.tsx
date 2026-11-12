import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "@/styles.css";
import "@/styles/patela-sections.css";
import "@/styles/patela-app.css";
import "@/styles/patela.css";
import { Providers } from "@/components/providers";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://patela.io"),
  title: "Patela — AI-verified crypto escrow for work",
  description: "Post jobs, lock crypto in escrow, and release payment when AI verifies the work.",
  authors: [{ name: "Patela" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Patela — AI-verified crypto escrow for work",
    description: "Post jobs, lock crypto in escrow, and release payment when AI verifies the work.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
