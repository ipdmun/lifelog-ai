import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScanProvider } from "@/contexts/ScanContext";

export const metadata: Metadata = {
  title: "CalToPaper - Digital Calendar to Printable Diary",
  description: "Convert your Google/Apple Calendar into beautiful printable PDF diary pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0ea5e9" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-to-content sr-only-focusable">
          Skip to main content
        </a>

        {/* ARIA live region for screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="announcements"
        />

        {/* Paper Texture Overlay */}
        <div className="grain-overlay"></div>

        <main id="main-content">
          <AuthProvider>
            <ScanProvider>
              <LanguageProvider>
                {children}
              </LanguageProvider>
            </ScanProvider>
          </AuthProvider>
        </main>
      </body>
    </html>
  );
}
