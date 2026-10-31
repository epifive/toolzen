# Writing a tool

Every tool is a single client component in `src/tools/components/<slug>.tsx`.

1. Add the tool's definition (name, category, icon, description, steps, FAQ) to `registry.ts` or one of
   the files in `defs/`. Keep `slug: "..."` and `icon: "..."` on their own lines. `icon` is any
   [Lucide](https://lucide.dev/icons) icon name in kebab-case, e.g. `"file-text"`.
2. Create `components/<slug>.tsx` with a default-exported React component that takes no props.
3. Run `npm run tools:generate`. It checks for duplicate slugs, missing components and unknown icons,
   then rewrites `loader.tsx` and `icons.tsx`.

Tool names, descriptions, steps and FAQs can be translated in Admin → Languages (keys
`tool.<slug>.name`, `tool.<slug>.description`, `tool.<slug>.stepN`, `tool.<slug>.faqN.q/a`).

## Server tools

Tools that need the network (DNS, SSL, HTTP checks) call `callServerTool(slug, input)` from
`lib/server-client.ts`. The handler lives in `src/lib/server-tools/` and is registered in
`SERVER_TOOL_HANDLERS`. Always fetch through `lib/server-tools/net.ts` (`parsePublicUrl`, `fetchOnce`,
`fetchFollow`): it blocks private and reserved addresses, including DNS-rebinding tricks, and limits
size, time and redirects. Throw `ToolInputError` for messages meant for the visitor.

## Rules

- Start the file with `"use client";`. Everything runs in the browser; never upload user files.
- Build the UI from `@/components/tool-ui` (`Panel`, `FileDropzone`, `FileRow`, `TextInput`, `OutputBox`,
  `CopyButton`, `Segmented`, `RangeField`, `Stat`, `StatGrid`, `ErrorText`, `Spinner`, `ToolColumns`) and
  `@/components/ui` (`Button`, `Input`, `Select`, `Textarea`, `Field`, `Checkbox`, `Switch`, `Alert`).
- Use the helpers in `@/lib/files` for downloads, ZIPs, images and canvases.
- Call `track()` from `useTool()` when the main action succeeds (it is throttled, so calling it from an
  effect for live tools is fine).
- File tools must use `FileDropzone`: it enforces the visitor's plan limits (`limits.maxFileMb`,
  `limits.maxBatch`).
- Load heavy libraries with `await import("...")` inside the handler so they only download when used.
- Show clear, specific error messages. Never let an exception escape to the page.
