"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function JpgToWebp() {
  return <FormatConverter from="image/jpeg" to="image/webp" />;
}
