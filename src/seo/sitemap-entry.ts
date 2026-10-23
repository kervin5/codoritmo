import type { MetadataRoute } from "next";

/** One sitemap row; every page group returns these for its own sitemap file. */
export type SitemapEntry = MetadataRoute.Sitemap[number];
