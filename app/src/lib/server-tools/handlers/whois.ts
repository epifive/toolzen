import "server-only";
import { z } from "zod";
import type { WhoisResult } from "@/tools/lib/server-types";
import type { ServerToolHandler } from "../index";
import { daysBetween, parseInput, textField } from "../input";
import { fetchFollow, parseHostname, ToolInputError, type FetchedResponse } from "../net";

/**
 * Domain registration data comes from RDAP, the structured successor of WHOIS.
 * rdap.org redirects to the authoritative registry's RDAP server.
 */
const RDAP_BOOTSTRAP = "https://rdap.org/domain/";
const MAX_RAW_BYTES = 200_000;

interface RdapEntity {
  roles?: unknown;
  vcardArray?: unknown;
  publicIds?: unknown;
  links?: unknown;
  entities?: unknown;
}

interface RdapDomain {
  ldhName?: unknown;
  status?: unknown;
  events?: unknown;
  nameservers?: unknown;
  secureDNS?: unknown;
  entities?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Reads one property (fn, email, tel, …) from a jCard: ["vcard", [[name, params, type, value], …]]. */
function vcardValue(entity: RdapEntity, property: string): string | null {
  const properties = list(list(entity.vcardArray)[1]);
  for (const item of properties) {
    const entry = list(item);
    if (entry[0] === property) {
      const value = entry[3];
      if (typeof value === "string") return str(value.replace(/^tel:/i, "").replace(/^mailto:/i, ""));
    }
  }
  return null;
}

function hasRole(entity: RdapEntity, role: string): boolean {
  return list(entity.roles).includes(role);
}

function eventDate(domain: RdapDomain, action: string): string | null {
  for (const event of list(domain.events)) {
    if (isRecord(event) && event.eventAction === action) {
      const date = str(event.eventDate);
      if (date && !Number.isNaN(Date.parse(date))) return new Date(date).toISOString();
    }
  }
  return null;
}

function summarise(domain: RdapDomain, fallbackName: string, server: string, raw: string): WhoisResult {
  const entities = list(domain.entities).filter(isRecord) as RdapEntity[];
  const registrar = entities.find((e) => hasRole(e, "registrar")) ?? null;
  const abuse = registrar ? ((list(registrar.entities).filter(isRecord) as RdapEntity[]).find((e) => hasRole(e, "abuse")) ?? null) : null;
  const ianaId = registrar
    ? (list(registrar.publicIds)
        .filter(isRecord)
        .filter((p) => /iana/i.test(String(p.type)))
        .map((p) => str(p.identifier))
        .find(Boolean) ?? null)
    : null;
  const registrarUrl = registrar
    ? (list(registrar.links)
        .filter(isRecord)
        .filter((l) => l.rel !== "self" && !/rdap/i.test(String(l.type ?? "")))
        .map((l) => str(l.href))
        .find((href) => href !== null && /^https?:\/\//i.test(href) && !/rdap/i.test(href)) ?? null)
    : null;

  const created = eventDate(domain, "registration");
  const expires = eventDate(domain, "expiration");
  const now = new Date();
  const secure = isRecord(domain.secureDNS) ? domain.secureDNS.delegationSigned : undefined;

  return {
    domain: (str(domain.ldhName) ?? fallbackName).toLowerCase(),
    registrar: registrar ? vcardValue(registrar, "fn") : null,
    registrarIanaId: ianaId,
    registrarUrl,
    abuseEmail: abuse ? vcardValue(abuse, "email") : null,
    abusePhone: abuse ? vcardValue(abuse, "tel") : null,
    created,
    updated: eventDate(domain, "last changed"),
    expires,
    ageDays: created ? daysBetween(new Date(created), now) : null,
    daysToExpiry: expires ? daysBetween(now, new Date(expires)) : null,
    status: list(domain.status)
      .map(str)
      .filter((s): s is string => s !== null)
      .slice(0, 20),
    nameservers: list(domain.nameservers)
      .filter(isRecord)
      .map((ns) => str(ns.ldhName)?.toLowerCase().replace(/\.$/, "") ?? null)
      .filter((ns): ns is string => ns !== null)
      .slice(0, 20),
    dnssec: typeof secure === "boolean" ? secure : null,
    rdapServer: server,
    raw,
  };
}

/** example.com, then its parent domains, so "www.example.co.uk" finds "example.co.uk". */
function candidates(hostname: string): string[] {
  const labels = hostname.split(".");
  const names: string[] = [];
  for (let i = 0; i <= labels.length - 2 && names.length < 3; i++) names.push(labels.slice(i).join("."));
  return names;
}

const whoisInput = z.object({ domain: textField("Enter a domain name, e.g. example.com.", 300) });

const whoisLookup: ServerToolHandler = async (input) => {
  const hostname = parseHostname(parseInput(whoisInput, input).domain);

  for (const name of candidates(hostname)) {
    let response: FetchedResponse;
    try {
      ({ final: response } = await fetchFollow(new URL(`${RDAP_BOOTSTRAP}${encodeURIComponent(name)}`), {
        maxRedirects: 5,
        maxBytes: 1_000_000,
      }));
    } catch (error) {
      if (error instanceof ToolInputError) throw new ToolInputError("The registry's RDAP server could not be reached. Try again later.");
      throw error;
    }
    if (response.status === 404) continue;
    if (response.status === 429) throw new ToolInputError("The registry is rate-limiting lookups right now. Try again in a minute.");
    if (response.status !== 200 || response.truncated) {
      throw new ToolInputError(`The registry's RDAP server returned an unexpected response (HTTP ${response.status}).`);
    }

    let data: unknown;
    try {
      data = JSON.parse(response.body);
    } catch {
      throw new ToolInputError("The registry returned data that could not be read.");
    }
    if (!isRecord(data)) throw new ToolInputError("The registry returned data that could not be read.");

    const pretty = JSON.stringify(data, null, 2);
    return summarise(data as RdapDomain, name, new URL(response.url).host, pretty.length > MAX_RAW_BYTES ? "" : pretty);
  }

  throw new ToolInputError(
    `No registration data was found for ${hostname}. The domain may be unregistered, or its registry doesn't publish RDAP data.`,
  );
};

export const WHOIS_HANDLERS: Record<string, ServerToolHandler> = {
  "whois-lookup": whoisLookup,
};
