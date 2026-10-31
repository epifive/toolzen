"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ErrorText, Panel, RangeField, Segmented, Spinner, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { canvasToBlob, downloadBlob, downloadText } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  cleanPhone,
  mailtoPayload,
  smsPayload,
  vCardPayload,
  wifiPayload,
  type VCardInput,
  type WifiEncryption,
} from "@/tools/lib/seo";

type QrType = "url" | "text" | "wifi" | "email" | "phone" | "sms" | "vcard";
type Ecc = "L" | "M" | "Q" | "H";

const TYPES: Array<{ value: QrType; label: string }> = [
  { value: "url", label: "URL" },
  { value: "text", label: "Text" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
  { value: "vcard", label: "vCard" },
];

interface Fields {
  url: string;
  text: string;
  ssid: string;
  wifiPassword: string;
  encryption: WifiEncryption;
  hidden: boolean;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  phone: string;
  smsPhone: string;
  smsMessage: string;
  vcard: VCardInput;
}

const INITIAL: Fields = {
  url: "",
  text: "",
  ssid: "",
  wifiPassword: "",
  encryption: "WPA",
  hidden: false,
  emailTo: "",
  emailSubject: "",
  emailBody: "",
  phone: "",
  smsPhone: "",
  smsMessage: "",
  vcard: {
    firstName: "",
    lastName: "",
    organization: "",
    title: "",
    phone: "",
    email: "",
    website: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  },
};

const VCARD_FIELDS: Array<{ key: keyof VCardInput; label: string; type?: string; wide?: boolean }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "organization", label: "Company" },
  { key: "title", label: "Job title" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "website", label: "Website", type: "url", wide: true },
  { key: "street", label: "Street address", wide: true },
  { key: "city", label: "City" },
  { key: "region", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The text encoded in the QR code, or "" when the required fields are empty. */
function buildPayload(type: QrType, f: Fields): string {
  switch (type) {
    case "url": {
      const url = f.url.trim();
      if (!url) return "";
      return /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`;
    }
    case "text":
      return f.text;
    case "wifi":
      return f.ssid ? wifiPayload(f.ssid, f.wifiPassword, f.encryption, f.hidden) : "";
    case "email":
      return f.emailTo.trim() ? mailtoPayload(f.emailTo, f.emailSubject, f.emailBody) : "";
    case "phone":
      return cleanPhone(f.phone) ? `tel:${cleanPhone(f.phone)}` : "";
    case "sms":
      return cleanPhone(f.smsPhone) ? smsPayload(f.smsPhone, f.smsMessage) : "";
    case "vcard":
      return Object.values(f.vcard).some((v) => v.trim()) ? vCardPayload(f.vcard) : "";
  }
}

/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

interface Rendered {
  key: string;
  svg?: string;
  error?: string;
}

export default function QrCodeGenerator() {
  const { track } = useTool();
  const [type, setType] = useState<QrType>("url");
  const [fields, setFields] = useState<Fields>(INITIAL);
  const [foreground, setForeground] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [ecc, setEcc] = useState<Ecc>("M");
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((prev) => ({ ...prev, [key]: value }));
  const setVCard = (key: keyof VCardInput, value: string) =>
    setFields((prev) => ({ ...prev, vcard: { ...prev.vcard, [key]: value } }));

  const payload = useMemo(() => buildPayload(type, fields), [type, fields]);
  const options = useMemo(
    () => ({ width: size, margin, errorCorrectionLevel: ecc, color: { dark: foreground, light: background } }),
    [size, margin, ecc, foreground, background],
  );
  const key = JSON.stringify([payload, options]);
  const current = rendered?.key === key ? rendered : null;
  // Keep showing the previous code while a new one renders, so typing doesn't flicker.
  const shown = payload ? rendered : null;

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import("qrcode");
        const svg = await QRCode.toString(payload, { ...options, type: "svg" });
        if (!cancelled) setRendered({ key, svg });
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (!cancelled) {
          setRendered({
            key,
            error: /too big/i.test(message)
              ? "There is too much data for a QR code. Shorten the content or choose a lower error correction level."
              : "The QR code could not be created from this content.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, options, key]);

  useEffect(() => {
    if (current?.svg) track();
  }, [current, track]);

  async function downloadPng() {
    setBusy(true);
    setDownloadError("");
    try {
      const QRCode = await import("qrcode");
      const canvas = await QRCode.toCanvas(payload, options);
      downloadBlob(await canvasToBlob(canvas), "qr-code.png");
    } catch {
      setDownloadError("The PNG could not be created. Try a smaller size.");
    } finally {
      setBusy(false);
    }
  }

  const contrast =
    (Math.max(luminance(foreground), luminance(background)) + 0.05) /
    (Math.min(luminance(foreground), luminance(background)) + 0.05);
  const inverted = luminance(foreground) > luminance(background);
  const emailInvalid = type === "email" && fields.emailTo.trim() !== "" && !EMAIL.test(fields.emailTo.trim());

  return (
    <ToolColumns>
      <div className="space-y-4">
        <Panel title="Content">
          <div className="space-y-4">
            <Segmented label="QR code type" value={type} onChange={setType} options={TYPES} />

            {type === "url" ? (
              <Field label="Website URL" htmlFor="qr-url" hint="https:// is added automatically when missing.">
                <Input
                  id="qr-url"
                  type="url"
                  inputMode="url"
                  value={fields.url}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
            ) : null}

            {type === "text" ? (
              <Field label="Text" htmlFor="qr-text">
                <Textarea
                  id="qr-text"
                  rows={5}
                  value={fields.text}
                  onChange={(e) => set("text", e.target.value)}
                  placeholder="Any text, up to a few hundred characters."
                />
              </Field>
            ) : null}

            {type === "wifi" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Network name (SSID)" htmlFor="qr-ssid">
                  <Input
                    id="qr-ssid"
                    value={fields.ssid}
                    onChange={(e) => set("ssid", e.target.value)}
                    placeholder="MyHomeWiFi"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Security" htmlFor="qr-encryption">
                  <Select
                    id="qr-encryption"
                    value={fields.encryption}
                    onChange={(e) => set("encryption", e.target.value as WifiEncryption)}
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (open network)</option>
                  </Select>
                </Field>
                {fields.encryption !== "nopass" ? (
                  <Field label="Password" htmlFor="qr-wifi-password" className="sm:col-span-2">
                    <Input
                      id="qr-wifi-password"
                      value={fields.wifiPassword}
                      onChange={(e) => set("wifiPassword", e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                ) : null}
                <Checkbox label="Hidden network" checked={fields.hidden} onChange={(e) => set("hidden", e.target.checked)} />
              </div>
            ) : null}

            {type === "email" ? (
              <div className="space-y-4">
                <Field
                  label="Email address"
                  htmlFor="qr-email-to"
                  hint={emailInvalid ? "This doesn't look like a valid email address." : undefined}
                >
                  <Input
                    id="qr-email-to"
                    type="email"
                    value={fields.emailTo}
                    onChange={(e) => set("emailTo", e.target.value)}
                    placeholder="hello@example.com"
                    aria-invalid={emailInvalid}
                  />
                </Field>
                <Field label="Subject" htmlFor="qr-email-subject">
                  <Input
                    id="qr-email-subject"
                    value={fields.emailSubject}
                    onChange={(e) => set("emailSubject", e.target.value)}
                  />
                </Field>
                <Field label="Message" htmlFor="qr-email-body">
                  <Textarea
                    id="qr-email-body"
                    rows={4}
                    value={fields.emailBody}
                    onChange={(e) => set("emailBody", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {type === "phone" ? (
              <Field label="Phone number" htmlFor="qr-phone" hint="Include the country code, e.g. +1 555 123 4567.">
                <Input
                  id="qr-phone"
                  type="tel"
                  value={fields.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </Field>
            ) : null}

            {type === "sms" ? (
              <div className="space-y-4">
                <Field label="Phone number" htmlFor="qr-sms-phone">
                  <Input
                    id="qr-sms-phone"
                    type="tel"
                    value={fields.smsPhone}
                    onChange={(e) => set("smsPhone", e.target.value)}
                    placeholder="+1 555 123 4567"
                  />
                </Field>
                <Field label="Message" htmlFor="qr-sms-message">
                  <Textarea
                    id="qr-sms-message"
                    rows={3}
                    value={fields.smsMessage}
                    onChange={(e) => set("smsMessage", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {type === "vcard" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {VCARD_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    htmlFor={`qr-vcard-${f.key}`}
                    className={f.wide ? "sm:col-span-2" : undefined}
                  >
                    <Input
                      id={`qr-vcard-${f.key}`}
                      type={f.type ?? "text"}
                      value={fields.vcard[f.key]}
                      onChange={(e) => setVCard(f.key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Appearance">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Foreground" htmlFor="qr-fg">
              <input
                id="qr-fg"
                type="color"
                value={foreground}
                onChange={(e) => setForeground(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
            </Field>
            <Field label="Background" htmlFor="qr-bg">
              <input
                id="qr-bg"
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
            </Field>
            <RangeField
              label="Size"
              value={size}
              min={128}
              max={1024}
              step={8}
              onChange={setSize}
              format={(v) => `${v} × ${v} px`}
            />
            <RangeField label="Margin" value={margin} min={0} max={10} onChange={setMargin} format={(v) => `${v} modules`} />
            <Field
              label="Error correction"
              htmlFor="qr-ecc"
              className="sm:col-span-2"
              hint="Higher levels survive damage or a logo on top, but make the code denser."
            >
              <Select id="qr-ecc" value={ecc} onChange={(e) => setEcc(e.target.value as Ecc)}>
                <option value="L">Low – 7% recovery</option>
                <option value="M">Medium – 15% recovery</option>
                <option value="Q">Quartile – 25% recovery</option>
                <option value="H">High – 30% recovery</option>
              </Select>
            </Field>
          </div>
          {inverted || contrast < 4 ? (
            <Alert tone="warning" className="mt-4">
              {inverted
                ? "Light codes on a dark background can't be read by some scanners. Use a darker foreground colour."
                : "The colours have low contrast, so the code may not scan reliably."}
            </Alert>
          ) : null}
        </Panel>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel title="Preview">
          {!payload ? (
            <p className="py-16 text-center text-sm text-muted">Fill in the details and your QR code appears here.</p>
          ) : shown?.error ? (
            <ErrorText>{shown.error}</ErrorText>
          ) : shown?.svg ? (
            <div
              role="img"
              aria-label="QR code preview"
              className="mx-auto max-w-80 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: shown.svg }}
            />
          ) : (
            <div className="grid place-items-center py-16">
              <Spinner className="size-6 text-muted" />
            </div>
          )}
          {shown?.svg ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={downloadPng} disabled={busy || !current?.svg}>
                {busy ? <Spinner /> : <Download aria-hidden />}
                Download PNG
              </Button>
              <Button
                variant="outline"
                disabled={!current?.svg}
                onClick={() => current?.svg && downloadText(current.svg, "qr-code.svg", "image/svg+xml")}
              >
                <Download aria-hidden />
                Download SVG
              </Button>
            </div>
          ) : null}
          {downloadError ? (
            <div className="mt-3">
              <ErrorText>{downloadError}</ErrorText>
            </div>
          ) : null}
        </Panel>
        {payload && type !== "url" && type !== "text" ? (
          <Panel title="Encoded data">
            <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all text-muted">{payload}</pre>
          </Panel>
        ) : null}
      </div>
    </ToolColumns>
  );
}
