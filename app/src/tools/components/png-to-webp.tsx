"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function PngToWebp() {
  return <FormatConverter from="image/png" to="image/webp" />;
}
