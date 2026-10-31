"use client";

import { EncodingTool } from "@/tools/lib/encoding";

export default function BinaryToText() {
  return <EncodingTool format="binary" direction="decode" />;
}
