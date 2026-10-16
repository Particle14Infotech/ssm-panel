import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: "https://smmarchitecture.com/sitemap.xml",
  };
}
