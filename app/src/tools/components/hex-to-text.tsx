"use client";

import { EncodingTool } from "@/tools/lib/encoding";

export default function HexToText() {
  return <EncodingTool format="hex" direction="decode" />;
}
