"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function WebpToJpg() {
  return <FormatConverter from="image/webp" to="image/jpeg" />;
}
