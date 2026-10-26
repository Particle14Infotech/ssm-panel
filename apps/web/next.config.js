/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  swcMinify: true,
  output: "standalone",
  transpilePackages: ["@smm/contracts", "@smm/config", "three", "framer-motion"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    let backendUrl = process.env.INTERNAL_API_URL || process.env.API_URL;
    if (!backendUrl && process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith("http")) {
      backendUrl = process.env.NEXT_PUBLIC_API_URL;
    }
    if (!backendUrl || backendUrl.includes("railway.app")) {
      backendUrl = process.env.DOCKER_CONTAINER === "true" ? "http://api:4000" : "http://127.0.0.1:4000";
    }
    const cleanBackend = backendUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${cleanBackend}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
