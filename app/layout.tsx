import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "WhaleChat",
  description: "A local-first DeepSeek chat client using your own API key",
};

/** Root layout: dark theme, Inter font, auth context and the global toast host. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        {/* Sonner, not react-hot-toast: Better Auth UI reports every auth error
            through it, so a second toast host would split the app's feedback
            across two different-looking widgets. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
