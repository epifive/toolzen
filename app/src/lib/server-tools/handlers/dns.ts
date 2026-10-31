import "server-only";
import { Resolver } from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import {
  DNS_RECORD_TYPES,
  type DnsLookupResult,
  type DnsRecord,
  type DnsRecordType,
  type DnsTypeResult,
  type MyIpResult,
  type ReverseDnsResult,
} from "@/tools/lib/server-types";
import type { ServerToolHandler } from "../index";
import { parseInput, textField, withTimeout } from "../input";
import { isPrivateAddress, parseHostname, ToolInputError } from "../net";

/** Public resolvers used for every lookup, so results don't depend on the hosting provider's DNS. */
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"];
const MAX_RECORDS = 100;
const MAX_VALUE_LENGTH = 4096;
const LOOKUP_BUDGET_MS = 10_000;

function createResolver(): Resolver {
  const resolver = new Resolver({ timeout: 2_500, tries: 2 });
  resolver.setServers(PUBLIC_RESOLVERS);
  return resolver;
}

/** Runs DNS work with a fresh resolver, cancelling any queries still pending when it finishes or times out. */
async function withResolver<T>(work: (resolver: Resolver) => Promise<T>, budgetMs = LOOKUP_BUDGET_MS): Promise<T> {
  const resolver = createResolver();
  try {
    return await withTimeout(work(resolver), budgetMs, "The DNS servers did not answer in time. Try again.");
  } finally {
    resolver.cancel();
  }
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException | undefined)?.code ?? "";
}

/** Domain names may start with service labels such as _dmarc or _sip._tcp, which hostnames can't. */
function parseDnsName(input: string): string {
  const match = input.trim().toLowerCase().match(/^((?:_[a-z0-9-]{1,62}\.)*)(.*)$/);
  return `${match?.[1] ?? ""}${parseHostname(match?.[2] ?? "")}`;
}

/**
 * Same address in canonical form (lower-case, compressed IPv6) so lookups can be
 * compared. IPv4-mapped IPv6 addresses (::ffff:1.2.3.4) become plain IPv4.
 */
function canonicalIp(ip: string): string {
  if (!net.isIPv6(ip)) return ip;
  const compressed = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const mapped = compressed.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!mapped) return compressed;
  const [high, low] = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

const CAA_TAGS = ["issue", "issuewild", "iodef", "contactemail", "contactphone"] as const;

const clip = (value: string) => (value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value);
const plain = (values: string[]): DnsRecord[] => values.map((value) => ({ value: clip(value), ttl: null }));

const RESOLVERS: Record<DnsRecordType, (resolver: Resolver, name: string) => Promise<DnsRecord[]>> = {
  A: async (r, name) => (await r.resolve4(name, { ttl: true })).map((a) => ({ value: a.address, ttl: a.ttl })),
  AAAA: async (r, name) => (await r.resolve6(name, { ttl: true })).map((a) => ({ value: a.address, ttl: a.ttl })),
  CNAME: async (r, name) => plain(await r.resolveCname(name)),
  MX: async (r, name) =>
    plain((await r.resolveMx(name)).sort((a, b) => a.priority - b.priority).map((mx) => `${mx.priority} ${mx.exchange || "."}`)),
  TXT: async (r, name) => plain((await r.resolveTxt(name)).map((chunks) => chunks.join(""))),
  NS: async (r, name) => plain((await r.resolveNs(name)).sort()),
  SOA: async (r, name) => {
    const soa = await r.resolveSoa(name);
    return plain([`${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`]);
  },
  CAA: async (r, name) =>
    plain(
      (await r.resolveCaa(name)).map((record) => {
        const tag = CAA_TAGS.find((t) => record[t] !== undefined);
        return tag ? `${record.critical} ${tag} "${record[tag]}"` : `${record.critical}`;
      }),
    ),
  SRV: async (r, name) =>
    plain(
      (await r.resolveSrv(name))
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
        .map((srv) => `${srv.priority} ${srv.weight} ${srv.port} ${srv.name}`),
    ),
};

const LOOKUP_ERRORS: Record<string, string> = {
  ETIMEOUT: "The DNS servers did not answer in time.",
  ECANCELLED: "The DNS servers did not answer in time.",
  ESERVFAIL: "The domain's name servers returned an error (SERVFAIL).",
  EREFUSED: "The query was refused by the DNS server.",
  ECONNREFUSED: "Could not reach the DNS servers.",
};

async function lookupType(resolver: Resolver, type: DnsRecordType, name: string): Promise<DnsTypeResult & { nxdomain: boolean }> {
  try {
    const records = await RESOLVERS[type](resolver, name);
    return { type, records: records.slice(0, MAX_RECORDS), error: null, nxdomain: false };
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENODATA") return { type, records: [], error: null, nxdomain: false };
    if (code === "ENOTFOUND") return { type, records: [], error: null, nxdomain: true };
    return { type, records: [], error: LOOKUP_ERRORS[code] ?? `The lookup failed (${code || "unknown error"}).`, nxdomain: false };
  }
}

const dnsLookupInput = z.object({
  domain: textField("Enter a domain name, e.g. example.com.", 300),
  type: z.enum([...DNS_RECORD_TYPES, "ALL"], { error: "Choose a record type." }).default("ALL"),
});

const dnsLookup: ServerToolHandler = async (input) => {
  const { domain, type } = parseInput(dnsLookupInput, input);
  const name = parseDnsName(domain);
  const types: DnsRecordType[] = type === "ALL" ? [...DNS_RECORD_TYPES] : [type];
  const started = Date.now();

  const results = await withResolver((resolver) => Promise.all(types.map((t) => lookupType(resolver, t, name))));
  if (results.every((r) => r.nxdomain)) throw new ToolInputError(`The domain ${name} does not exist (NXDOMAIN).`);

  const result: DnsLookupResult = {
    domain: name,
    resolvers: PUBLIC_RESOLVERS,
    results: results.map(({ type: t, records, error }) => ({ type: t, records, error })),
    timeMs: Date.now() - started,
  };
  return result;
};

const reverseDnsInput = z.object({ ip: textField("Enter an IPv4 or IPv6 address.", 64) });

const reverseDnsLookup: ServerToolHandler = async (input) => {
  const raw = parseInput(reverseDnsInput, input).ip.replace(/^\[|\]$/g, "");
  if (!net.isIP(raw)) throw new ToolInputError("Enter a valid IPv4 or IPv6 address, e.g. 8.8.8.8.");
  const ip = canonicalIp(raw);
  if (isPrivateAddress(ip)) throw new ToolInputError("Private and reserved addresses have no public reverse DNS.");
  const version = net.isIPv4(ip) ? 4 : 6;
  const started = Date.now();

  const hostnames = await withResolver(async (resolver) => {
    let names: string[];
    try {
      names = (await resolver.reverse(ip)).slice(0, 10);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOTFOUND" || code === "ENODATA") return [];
      throw new ToolInputError(LOOKUP_ERRORS[code] ?? "The reverse lookup failed. Try again.");
    }
    return Promise.all(
      names.map(async (hostname, index) => {
        if (index >= 5) return { hostname, forwardConfirmed: false, addresses: [] };
        let addresses: string[] = [];
        try {
          addresses = version === 4 ? await resolver.resolve4(hostname) : await resolver.resolve6(hostname);
        } catch {
          addresses = [];
        }
        const canonical = addresses.slice(0, 20).map(canonicalIp);
        return { hostname, forwardConfirmed: canonical.includes(ip), addresses: canonical };
      }),
    );
  });

  const result: ReverseDnsResult = { ip, version, hostnames, timeMs: Date.now() - started };
  return result;
};

const whatIsMyIp: ServerToolHandler = async (_input, ctx) => {
  const candidate = ctx.ip.trim();
  const ip = net.isIP(candidate) ? canonicalIp(candidate) : null;
  const isPublic = ip !== null && !isPrivateAddress(ip);

  let hostnames: string[] = [];
  if (ip && isPublic) {
    try {
      hostnames = await withResolver(async (resolver) => (await resolver.reverse(ip)).slice(0, 5), 4_000);
    } catch {
      hostnames = [];
    }
  }

  const result: MyIpResult = {
    ip,
    version: ip ? (net.isIPv4(ip) ? 4 : 6) : null,
    isPublic,
    hostnames,
    userAgent: (ctx.headers.get("user-agent") ?? "").slice(0, 512),
    language: (ctx.headers.get("accept-language") ?? "").slice(0, 200),
  };
  return result;
};

export const DNS_HANDLERS: Record<string, ServerToolHandler> = {
  "dns-lookup": dnsLookup,
  "reverse-dns-lookup": reverseDnsLookup,
  "what-is-my-ip": whatIsMyIp,
};
