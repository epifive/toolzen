import "server-only";
import tls, { type DetailedPeerCertificate, type TLSSocket } from "node:tls";
import { z } from "zod";
import type { CertificateSummary, SslResult } from "@/tools/lib/server-types";
import type { ServerToolHandler } from "../index";
import { daysBetween, parseInput, textField } from "../input";
import { parseHostname, resolvePublic, ToolInputError } from "../net";

const PORT = 443;
const TIMEOUT_MS = 10_000;
const MAX_CHAIN = 8;
const MAX_SANS = 200;
const ALTNAME_ERROR = "ERR_TLS_CERT_ALTNAME_INVALID";

/** Formats a certificate name such as { CN: "example.com", O: "Example" } as "CN=example.com, O=Example". */
function formatName(name: tls.Certificate | undefined): string {
  if (!name) return "";
  return Object.entries(name)
    .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(" + ") : value}`)
    .join(", ");
}

function isoDate(value: string | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function keyInfo(cert: DetailedPeerCertificate): string | null {
  if (cert.asn1Curve || cert.nistCurve) return `EC ${cert.nistCurve ?? cert.asn1Curve}`;
  if (cert.bits) return `RSA ${cert.bits}-bit`;
  return null;
}

/** Walks from the leaf to the root. The root's issuerCertificate points back at itself. */
function chainOf(leaf: DetailedPeerCertificate): CertificateSummary[] {
  const chain: CertificateSummary[] = [];
  const seen = new Set<string>();
  let cert: DetailedPeerCertificate | undefined = leaf;
  while (cert && chain.length < MAX_CHAIN && !seen.has(cert.fingerprint256)) {
    seen.add(cert.fingerprint256);
    const issuer: DetailedPeerCertificate | undefined = cert.issuerCertificate;
    chain.push({
      subject: formatName(cert.subject),
      issuer: formatName(cert.issuer),
      validTo: isoDate(cert.valid_to),
      selfSigned: !issuer || issuer.fingerprint256 === cert.fingerprint256,
    });
    cert = issuer;
  }
  return chain;
}

/** Opens a TLS connection to an already validated public IP, using the hostname for SNI. */
function handshake(ip: string, servername: string): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: ip,
      port: PORT,
      servername,
      // Invalid certificates are inspected and reported rather than rejected.
      rejectUnauthorized: false,
    });
    const fail = (message: string) => {
      socket.destroy();
      reject(new ToolInputError(message));
    };
    socket.setTimeout(TIMEOUT_MS, () => fail(`${servername} did not complete the TLS handshake in time.`));
    socket.once("secureConnect", () => {
      socket.setTimeout(0);
      resolve(socket);
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNREFUSED") fail(`${servername} is not accepting connections on port ${PORT}.`);
      else if (error.code === "ECONNRESET") fail(`${servername} closed the connection during the TLS handshake.`);
      else fail(`Could not establish a TLS connection to ${servername}. The site may not support HTTPS.`);
    });
  });
}

const sslInput = z.object({ host: textField("Enter a domain name, e.g. example.com.", 300) });

const sslChecker: ServerToolHandler = async (input) => {
  const host = parseHostname(parseInput(sslInput, input).host);
  const addresses = await resolvePublic(host);
  const ip = (addresses.find((a) => a.family === 4) ?? addresses[0]).address;

  const socket = await handshake(ip, host);
  try {
    const cert = socket.getPeerCertificate(true);
    if (!cert || !cert.fingerprint256) throw new ToolInputError(`${host} did not present a certificate.`);

    const authorizationError = socket.authorizationError ? String(socket.authorizationError) : null;
    const hostnameMatch = tls.checkServerIdentity(host, cert) === undefined;
    const chainTrusted = socket.authorized || authorizationError === ALTNAME_ERROR;
    const validFrom = isoDate(cert.valid_from);
    const validTo = isoDate(cert.valid_to);
    const cipher = socket.getCipher();

    const result: SslResult = {
      host,
      ip,
      protocol: socket.getProtocol(),
      cipher: cipher ? cipher.standardName || cipher.name : null,
      authorized: socket.authorized,
      authorizationError,
      hostnameMatch,
      chainTrusted,
      subject: formatName(cert.subject),
      issuer: formatName(cert.issuer),
      sans: (cert.subjectaltname ?? "")
        .split(/,\s*/)
        .map((entry) => entry.replace(/^(DNS|IP Address):/, "").trim())
        .filter(Boolean)
        .slice(0, MAX_SANS),
      validFrom,
      validTo,
      daysRemaining: validTo ? daysBetween(new Date(), new Date(validTo)) : null,
      serialNumber: cert.serialNumber,
      fingerprint256: cert.fingerprint256,
      keyInfo: keyInfo(cert),
      chain: chainOf(cert),
    };
    return result;
  } finally {
    socket.destroy();
  }
};

export const SSL_HANDLERS: Record<string, ServerToolHandler> = {
  "ssl-checker": sslChecker,
};
