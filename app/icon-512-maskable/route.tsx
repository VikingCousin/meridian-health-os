import { ImageResponse } from "next/og";
import { IconMark } from "@/lib/pwa/icon-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Maskable variant: extra padding so Android's adaptive-icon mask (circle,
// squircle, rounded square, ...) never clips the mark.
export async function GET() {
  return new ImageResponse(<IconMark size={512} paddingRatio={0.28} />, size);
}
