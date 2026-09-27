import { ImageResponse } from "next/og";
import { IconMark } from "@/lib/pwa/icon-mark";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(<IconMark size={192} />, size);
}
