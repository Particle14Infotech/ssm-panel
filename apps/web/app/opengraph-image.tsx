import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "SMM Panel - Social Growth Services & API Infrastructure";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          background: "#02040A",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Glow ambient background element */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.2) 0%, rgba(2,4,10,0) 70%)",
          }}
        />

        {/* Top telemetry badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 24px",
            borderRadius: "9999px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#3B82F6",
            }}
          />
          <span
            style={{
              fontSize: "18px",
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#60A5FA",
              textTransform: "uppercase",
            }}
          >
            Platform Active • SMM Panel
          </span>
        </div>

        {/* Headline and description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h1
            style={{
              fontSize: "64px",
              fontWeight: 300,
              color: "#FFFFFF",
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: "-0.03em",
              maxWidth: "950px",
            }}
          >
            Order Social Growth Services.{" "}
            <span style={{ color: "#3B82F6", fontWeight: 400 }}>Track Every Order.</span>
          </h1>

          <p
            style={{
              fontSize: "24px",
              color: "#94A3B8",
              margin: 0,
              lineHeight: 1.4,
              maxWidth: "850px",
              fontWeight: 300,
            }}
          >
            One unified wallet in INR, 500+ direct provider services, real-time sync, and double-entry protected ledger accounting.
          </p>
        </div>

        {/* Footer badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            paddingTop: "30px",
          }}
        >
          <span style={{ fontSize: "20px", color: "#FFFFFF", fontWeight: 500, letterSpacing: "0.05em" }}>
            smmarchitecture.com
          </span>
          <span style={{ fontSize: "18px", color: "#64748B" }}>
            Instagram • YouTube • TikTok • Telegram • X
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
