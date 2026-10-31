import "server-only";
import { DNS_HANDLERS } from "./handlers/dns";
import { HTTP_HANDLERS } from "./handlers/http";
import { PAGE_HANDLERS } from "./handlers/page";
import { SSL_HANDLERS } from "./handlers/ssl";
import { WHOIS_HANDLERS } from "./handlers/whois";

/**
 * Server-side tool handlers, keyed by tool slug. Each handler receives the JSON
 * body posted by the tool's component and returns JSON-serialisable data.
 * Throw ToolInputError (from ./net) for messages that should be shown to the visitor.
 */
export interface ServerToolContext {
  ip: string;
  headers: Headers;
}

export type ServerToolHandler = (input: Record<string, unknown>, ctx: ServerToolContext) => Promise<unknown>;

export const SERVER_TOOL_HANDLERS: Record<string, ServerToolHandler> = {
  ...DNS_HANDLERS,
  ...WHOIS_HANDLERS,
  ...SSL_HANDLERS,
  ...HTTP_HANDLERS,
  ...PAGE_HANDLERS,
};
