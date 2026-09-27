import { ImageResponse } from "next/og";
import { IconMark } from "@/lib/pwa/icon-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple requires an opaque background for the home-screen icon — IconMark's
// canvas is already fully opaque, so no extra handling needed here.
export default function AppleIcon() {
  return new ImageResponse(<IconMark size={180} paddingRatio={0.1} />, size);
}
