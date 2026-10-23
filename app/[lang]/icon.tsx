import { ImageResponse } from "next/og";

import { LogoArt } from "@/src/components/brand/logo-mark";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {LogoArt({ size: 32 })}
      </div>
    ),
    {
      ...size,
    }
  );
}
