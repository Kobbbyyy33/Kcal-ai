import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: "#7da03c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              background: "radial-gradient(circle at 28% 24%, #f9b61a 0%, #e55f15 55%, #f52e18 100%)",
              color: "#fff",
              fontSize: 28,
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

