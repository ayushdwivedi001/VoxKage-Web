import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VoxKage AI",
  description: "What should we build, sir?",
  icons: {
    icon: "/assets/voxkage_logo.png?v=3",
  },
};

// Inline script that runs synchronously BEFORE React hydrates.
// Reads localStorage to restore the correct theme class on <html>
// without any flash of wrong theme (FOIT prevention).
const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('voxkage_theme_mode');
    var cls = document.documentElement.classList;
    if (t === 'light') {
      cls.add('light');
      cls.remove('dark');
    } else if (t === 'dark') {
      cls.add('dark');
      cls.remove('light');
    } else {
      // 'system' or not set — respect OS preference
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        cls.add('dark');
        cls.remove('light');
      } else {
        cls.add('light');
        cls.remove('dark');
      }
    }
  } catch(e) {
    // Fallback to dark if localStorage/matchMedia unavailable
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking script — must run before any paint to prevent theme flash */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-component */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col text-zinc-100 overflow-hidden select-none"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
