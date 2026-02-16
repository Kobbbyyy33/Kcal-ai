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
          background: "#f2f5ea"
        }}
      >
        <div
          style={{
            width: 472,
            height: 472,
            borderRadius: 80,
            background: "#7da03c",
            boxShadow: "0 30px 80px rgba(33,80,44,0.24)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 64,
              width: 108,
              height: 48,
              borderRadius: 99,
              transform: "rotate(-24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 58,
              width: 108,
              height: 48,
              borderRadius: 99,
              transform: "rotate(24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              width: 324,
              height: 324,
              borderRadius: 9999,
              background: "radial-gradient(circle at 28% 24%, #f9b61a 0%, #e55f15 55%, #f52e18 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: 174,
                fontWeight: 900,
                fontFamily: "Arial, sans-serif",
                lineHeight: 1
              }}
            >
              K
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
