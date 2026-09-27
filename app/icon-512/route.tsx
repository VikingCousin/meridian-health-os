import { ImageResponse } from "next/og";
import { IconMark } from "@/lib/pwa/icon-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(<IconMark size={512} />, size);
}
