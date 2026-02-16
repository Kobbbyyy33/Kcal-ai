import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "KCAL AI",
  description: "PWA de tracking calories avec photo IA, scan code-barres et journal de repas.",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#7da03c"
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${manrope.variable} ${sora.variable}`}>
        {children}
        <Toaster
          richColors
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border !border-[#dbe0d6] !bg-white !text-slate-900 dark:!border-slate-700 dark:!bg-slate-900 dark:!text-slate-100",
              success: "!border-[#c9dfaa] !bg-[#eaf4dd] !text-[#21502c]",
              error: "!border-[#f9c3ba] !bg-[#fde6e2] !text-[#f52e18]"
            }
          }}
        />
      </body>
    </html>
  );
}
