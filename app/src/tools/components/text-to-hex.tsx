"use client";

import { EncodingTool } from "@/tools/lib/encoding";

export default function TextToHex() {
  return <EncodingTool format="hex" direction="encode" />;
}
