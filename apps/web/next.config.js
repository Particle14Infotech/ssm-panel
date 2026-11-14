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
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn-us.com",
      },
    ],
  },
  async rewrites() {
    let backendUrl = process.env.INTERNAL_API_URL || "http://api:4000";
    if (process.env.NODE_ENV === "development" && !process.env.INTERNAL_API_URL) {
      backendUrl = "http://127.0.0.1:4000";
    }
    const cleanBackend = backendUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    const fastifyUrl = process.env.INTERNAL_FASTIFY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    const defaultPrefixes = "health,catalog,services,platforms,admin/platforms,users,settings,notifications,tickets,favorites,auth,reseller,providers,orders,packages,wallet,payments,admin,coupons,bonuses,announcements,reports,webhooks";
    const fastifyPrefixes = (process.env.FASTIFY_ROUTE_PREFIXES || defaultPrefixes)
      .split(",")
      .map((prefix) => prefix.trim().replace(/^\/+|\/+$/g, ""))
      .filter((prefix) => /^[a-zA-Z0-9/_*-]+$/.test(prefix));
    const isAllFastify = fastifyPrefixes.includes("*");
    const fastifyRewrites = fastifyUrl
      ? isAllFastify
        ? [
            {
              source: "/api/v1/:path*",
              destination: `${fastifyUrl}/api/v1/:path*`,
            },
          ]
        : fastifyPrefixes.map((prefix) => ({
            source: `/api/v1/${prefix}/:path*`,
            destination: `${fastifyUrl}/api/v1/${prefix}/:path*`,
          }))
      : [];
    return [
      ...fastifyRewrites,
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
