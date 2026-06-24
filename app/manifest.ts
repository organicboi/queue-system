import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VibeQueue",
    short_name: "VibeQueue",
    description: "Queue management platform for businesses",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#6366F1",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
