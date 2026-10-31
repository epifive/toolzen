"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function WebpToPng() {
  return <FormatConverter from="image/webp" to="image/png" />;
}
