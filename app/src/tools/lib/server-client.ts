/** Calls a server-side tool endpoint and returns its result or throws a readable error. */
export async function callServerTool<T>(slug: string, input: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/tools/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data.result as T;
}
