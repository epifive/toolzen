"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function PngToJpg() {
  return <FormatConverter from="image/png" to="image/jpeg" />;
}
