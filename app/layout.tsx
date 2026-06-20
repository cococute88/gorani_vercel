import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import AuthGate from "@/components/auth/AuthGate";

const APP_NAME = "고라니 자산관리";
const APP_DESCRIPTION = "고라니 자산관리 — 포트폴리오 자산 관리 대시보드";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/gorani-logo.png"],
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/gorani-logo.png"],
  },
  icons: {
    icon: "/gorani-logo.png",
    shortcut: "/gorani-logo.png",
    apple: "/gorani-logo.png",
  },
};

// Runs before first paint to set the <html> theme class from storage,
// preventing a light/dark flash. Default is "light" for new users; stored dark mode is preserved.
const themeInitScript = `(function(){try{var k='gorani-theme';var p=localStorage.getItem(k);var s=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=(p==='light'||p==='dark')?p:(p==='system'?s:'light');var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){var r2=document.documentElement;r2.classList.add('light');r2.style.colorScheme='light';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthGate>{children}</AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
