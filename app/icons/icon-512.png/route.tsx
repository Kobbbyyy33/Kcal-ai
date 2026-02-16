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
          background: "linear-gradient(145deg, #f7f7f2 0%, #eef4e5 100%)"
        }}
      >
        <div
          style={{
            width: 436,
            height: 436,
            borderRadius: 9999,
            background: "#7da03c",
            boxShadow: "0 30px 80px rgba(33,80,44,0.22)",
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
              top: 34,
              left: 58,
              width: 104,
              height: 48,
              borderRadius: 99,
              transform: "rotate(-24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 34,
              right: 52,
              width: 104,
              height: 48,
              borderRadius: 99,
              transform: "rotate(24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              width: 314,
              height: 314,
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
                fontSize: 172,
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
