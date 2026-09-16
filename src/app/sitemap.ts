import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tuitiontrack-app.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/ai`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
