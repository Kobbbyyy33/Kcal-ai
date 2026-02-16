import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
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
          background: "#f3f6ec"
        }}
      >
        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: 36,
            background: "#7da03c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 24px rgba(33,80,44,0.2)"
          }}
        >
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 9999,
              background: "radial-gradient(circle at 28% 24%, #f9b61a 0%, #e55f15 55%, #f52e18 100%)",
              color: "#fff",
              fontSize: 68,
              fontWeight: 900,
              fontFamily: "Arial, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            K
          </div>
        </div>
      </div>
    ),
    size
  );
}

