import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, priority: 1, changeFrequency: "monthly" },
    { url: `${siteConfig.url}/rv-services`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${siteConfig.url}/home-services`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${siteConfig.url}/faq`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${siteConfig.url}/pricing-service-policy`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${siteConfig.url}/privacy`, priority: 0.2, changeFrequency: "yearly" },
    { url: `${siteConfig.url}/terms`, priority: 0.2, changeFrequency: "yearly" },
  ];
}
