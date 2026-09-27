import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meridian — Personal Health OS",
    short_name: "Meridian",
    description: "A personal biological command center — profile, biomarkers, journal, goals, and experiments, kept local.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#090d14",
    theme_color: "#090d14",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
