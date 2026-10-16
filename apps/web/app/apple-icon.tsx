import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #EBFF99 0%, #D4F074 50%, #8CC61C 100%)",
          borderRadius: "44px",
        }}
      >
        <svg viewBox="0 0 100 100" width="124" height="124">
          <rect x="18" y="58" width="15" height="22" rx="7" fill="#131313" />
          <rect x="39" y="42" width="15" height="38" rx="7" fill="#131313" />
          <rect x="60" y="38" width="16" height="42" rx="8" fill="#131313" />
          <polygon points="68,14 86,40 50,40" fill="#131313" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
