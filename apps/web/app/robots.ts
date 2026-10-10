import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/admin/", "/api/"],
      },
    ],
    sitemap: "https://aethersmm.internal/sitemap.xml",
  };
}
