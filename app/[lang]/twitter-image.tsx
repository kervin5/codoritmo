import { ImageResponse } from "next/og";
import { defaultLocale, hasLocale } from "@/src/i18n/config";

export const runtime = "nodejs";
export const alt = "Codoritmo";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const slogans = {
  es: "Pseudocódigo en el navegador",
  en: "Pseudocode in your browser",
};

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const slogan = slogans[locale];

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #e7dccb 0%, #f3ede3 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative shapes matching app colors */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            right: "100px",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "#88b369",
            opacity: 0.25,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "90px",
            left: "110px",
            width: "110px",
            height: "110px",
            borderRadius: "24px",
            background: "#dc8e6f",
            opacity: 0.22,
            display: "flex",
            transform: "rotate(45deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "180px",
            left: "70px",
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            background: "#78aeb1",
            opacity: 0.25,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "140px",
            right: "140px",
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "#c88ca3",
            opacity: 0.23,
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "110px",
              height: "110px",
              borderRadius: "22px",
              background: "rgba(255, 255, 255, 0.7)",
              marginBottom: "36px",
              boxShadow: "0 12px 40px rgba(43, 36, 28, 0.12)",
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2f816b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "88px",
              fontWeight: "900",
              color: "#29261f",
              marginBottom: "22px",
              display: "flex",
              letterSpacing: "-0.03em",
            }}
          >
            Codoritmo
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "40px",
              color: "#4c4131",
              textAlign: "center",
              maxWidth: "750px",
              lineHeight: 1.25,
              display: "flex",
              fontWeight: "600",
            }}
          >
            {slogan}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
