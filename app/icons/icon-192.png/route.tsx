import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a"
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 9999,
            background: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 70,
              height: 35,
              borderLeft: "16px solid white",
              borderBottom: "16px solid white",
              transform: "rotate(-45deg) translateY(-6px)"
            }}
          />
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}

