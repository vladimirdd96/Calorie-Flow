import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calorie Flow",
  description: "Fast, private calorie tracking without the clutter.",
  applicationName: "Calorie Flow",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Calorie Flow", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08110f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="calorie-flow-build" content={process.env.NEXT_PUBLIC_BUILD_ID || "development"} />
      </head>
      <body>{children}</body>
    </html>
  );
}
