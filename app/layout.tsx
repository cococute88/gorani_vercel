import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "고라파이 Gorani-Finance",
  description: "Next.js + TS + Tailwind + Recharts",
  icons: {
    icon: "/gorani-logo.png",
    shortcut: "/gorani-logo.png",
    apple: "/gorani-logo.png",
  },
};

// Runs before first paint to set the <html> theme class from storage,
// preventing a light/dark flash. Default is "dark" to match the app's look.
const themeInitScript = `(function(){try{var k='gorani-theme';var p=localStorage.getItem(k);var s=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=(p==='light'||p==='dark')?p:(p==='system'?s:'dark');var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){var r2=document.documentElement;r2.classList.add('dark');r2.style.colorScheme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
