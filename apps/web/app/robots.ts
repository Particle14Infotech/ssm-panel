import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smmpanel.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/dev/",
          "/dashboard",
          "/orders",
          "/wallet",
          "/transactions",
          "/support",
          "/new-order",
          "/profile",
          "/login",
          "/register",
          "/forgot-password",
          "/verify",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
