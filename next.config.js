import withPWAInit from "next-pwa";

const isDev = process.env.NODE_ENV === "development";
const isDevPwaEnabled = process.env.NEXT_PUBLIC_PWA_DEV === "true";

const withPWA = withPWAInit({
  dest: "public",
  // PWA always enabled in production; opt-in in development via NEXT_PUBLIC_PWA_DEV=true.
  disable: isDev && !isDevPwaEnabled,
  customWorkerDir: "worker",
  register: true,
  skipWaiting: true
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.openfoodfacts.org" }
    ]
  }
};

export default withPWA(nextConfig);
