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
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 190,
              height: 95,
              borderLeft: "42px solid white",
              borderBottom: "42px solid white",
              transform: "rotate(-45deg) translateY(-12px)"
            }}
          />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}

