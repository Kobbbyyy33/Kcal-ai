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
            width: 164,
            height: 164,
            borderRadius: 9999,
            background: "#7da03c",
            boxShadow: "0 14px 30px rgba(33,80,44,0.22)",
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
              top: 12,
              left: 18,
              width: 34,
              height: 16,
              borderRadius: 99,
              transform: "rotate(-24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 16,
              width: 34,
              height: 16,
              borderRadius: 99,
              transform: "rotate(24deg)",
              background: "#21502c"
            }}
          />
          <div
            style={{
              width: 120,
              height: 120,
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
                fontSize: 66,
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
    { width: 192, height: 192 }
  );
}
