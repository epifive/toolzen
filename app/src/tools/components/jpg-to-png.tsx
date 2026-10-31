"use client";

import { FormatConverter } from "@/tools/lib/image-format";

export default function JpgToPng() {
  return <FormatConverter from="image/jpeg" to="image/png" />;
}
