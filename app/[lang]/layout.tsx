import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

import { defaultLocale, hasLocale, locales } from "@/src/i18n/config";
import { getDictionary } from "@/src/i18n/server";
import {
  localeAlternates,
  openGraphLocale,
  localizedSiteUrl,
  siteUrl,
} from "@/src/seo/site";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    lang: string;
  }>;
}

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const dictionary = await getDictionary(locale);

  return {
    metadataBase: new URL(siteUrl),
    applicationName: dictionary.metadata.siteName,
    title: {
      default: dictionary.metadata.title,
      template: `%s | ${dictionary.metadata.siteName}`,
    },
    description: dictionary.metadata.description,
    keywords: dictionary.metadata.keywords,
    alternates: {
      canonical: localizedSiteUrl(locale),
      languages: localeAlternates(),
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: dictionary.metadata.siteName,
      locale: openGraphLocale(locale),
      title: dictionary.metadata.title,
      description: dictionary.metadata.description,
      url: localizedSiteUrl(locale),
      images: [
        {
          url: `${siteUrl}/${locale}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: dictionary.metadata.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary.metadata.title,
      description: dictionary.metadata.description,
      images: [`${siteUrl}/${locale}/opengraph-image`],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<LocaleLayoutProps>) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[var(--background)] antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
