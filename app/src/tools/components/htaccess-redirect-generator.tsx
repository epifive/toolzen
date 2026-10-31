"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { OutputBox, Panel, Segmented, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { buildHtaccess, validateHtaccess, type HtaccessOptions, type PageRedirect } from "@/tools/lib/seo";

interface RedirectRow extends PageRedirect {
  id: string;
}

type WwwMode = HtaccessOptions["www"];

const newRow = (): RedirectRow => ({ id: crypto.randomUUID(), from: "", to: "", code: 301 });

export default function HtaccessRedirectGenerator() {
  const { track } = useTool();
  const [redirectsOn, setRedirectsOn] = useState(true);
  const [redirects, setRedirects] = useState<RedirectRow[]>(() => [newRow()]);
  const [domainOn, setDomainOn] = useState(false);
  const [oldDomain, setOldDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [forceHttps, setForceHttps] = useState(false);
  const [www, setWww] = useState<WwwMode>("keep");
  const [removeTrailingSlash, setRemoveTrailingSlash] = useState(false);
  const [notFoundOn, setNotFoundOn] = useState(false);
  const [notFoundPage, setNotFoundPage] = useState("/404.html");

  const options = useMemo<HtaccessOptions>(
    () => ({
      redirects: redirectsOn ? redirects : [],
      domainMove: domainOn ? { oldDomain, newDomain } : null,
      forceHttps,
      www,
      removeTrailingSlash,
      notFoundPage: notFoundOn ? notFoundPage : "",
    }),
    [redirectsOn, redirects, domainOn, oldDomain, newDomain, forceHttps, www, removeTrailingSlash, notFoundOn, notFoundPage],
  );
  const errors = useMemo(() => validateHtaccess(options), [options]);
  const output = useMemo(() => (errors.length ? "" : buildHtaccess(options)), [errors, options]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  const updateRow = (id: string, patch: Partial<PageRedirect>) =>
    setRedirects((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <ToolColumns>
      <div className="space-y-4">
        <Panel
          title="Page redirects"
          actions={
            <Switch
              label={<span className="sr-only">Enable page redirects</span>}
              checked={redirectsOn}
              onChange={(e) => setRedirectsOn(e.target.checked)}
            />
          }
        >
          {redirectsOn ? (
            <div className="space-y-3">
              {redirects.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end sm:border-0 sm:p-0"
                >
                  <Field
                    label={index === 0 ? "Old path" : <span className="sm:sr-only">Old path</span>}
                    htmlFor={`ht-from-${row.id}`}
                  >
                    <Input
                      id={`ht-from-${row.id}`}
                      value={row.from}
                      onChange={(e) => updateRow(row.id, { from: e.target.value })}
                      placeholder="/old-page.html"
                      className="font-mono"
                      spellCheck={false}
                    />
                  </Field>
                  <Field
                    label={index === 0 ? "New URL" : <span className="sm:sr-only">New URL</span>}
                    htmlFor={`ht-to-${row.id}`}
                  >
                    <Input
                      id={`ht-to-${row.id}`}
                      value={row.to}
                      onChange={(e) => updateRow(row.id, { to: e.target.value })}
                      placeholder="https://example.com/new-page"
                      className="font-mono"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label={index === 0 ? "Type" : <span className="sm:sr-only">Type</span>} htmlFor={`ht-code-${row.id}`}>
                    <Select
                      id={`ht-code-${row.id}`}
                      value={row.code}
                      onChange={(e) => updateRow(row.id, { code: Number(e.target.value) as PageRedirect["code"] })}
                      className="sm:w-40"
                    >
                      <option value={301}>301 Permanent</option>
                      <option value={302}>302 Temporary</option>
                    </Select>
                  </Field>
                  <Button
                    variant="ghost"
                    className="justify-self-start px-2.5"
                    aria-label={`Remove redirect ${index + 1}`}
                    disabled={redirects.length === 1}
                    onClick={() => setRedirects((prev) => prev.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setRedirects((prev) => [...prev, newRow()])}>
                <Plus aria-hidden />
                Add redirect
              </Button>
              <p className="text-xs text-muted">Old paths may include a query string, e.g. /product.php?id=12.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Turn on to redirect individual pages.</p>
          )}
        </Panel>

        <Panel title="Site-wide rules">
          <div className="space-y-5">
            <div className="space-y-3">
              <Switch
                label="Move to a new domain"
                description="Redirects every page to the same path on the new domain."
                checked={domainOn}
                onChange={(e) => setDomainOn(e.target.checked)}
              />
              {domainOn ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Old domain" htmlFor="ht-old-domain">
                    <Input
                      id="ht-old-domain"
                      value={oldDomain}
                      onChange={(e) => setOldDomain(e.target.value)}
                      placeholder="old-site.com"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="New domain" htmlFor="ht-new-domain">
                    <Input
                      id="ht-new-domain"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="new-site.com"
                      spellCheck={false}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
            <Switch
              label="Force HTTPS"
              description="Sends every http:// request to https://."
              checked={forceHttps}
              onChange={(e) => setForceHttps(e.target.checked)}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Preferred host name</p>
              <Segmented<WwwMode>
                label="Preferred host name"
                value={www}
                onChange={setWww}
                options={[
                  { value: "keep", label: "No change" },
                  { value: "www", label: "Force www" },
                  { value: "non-www", label: "Remove www" },
                ]}
              />
            </div>
            <Switch
              label="Remove trailing slash"
              description="/about/ → /about (real folders are left alone)."
              checked={removeTrailingSlash}
              onChange={(e) => setRemoveTrailingSlash(e.target.checked)}
            />
            <div className="space-y-3">
              <Switch label="Custom 404 page" checked={notFoundOn} onChange={(e) => setNotFoundOn(e.target.checked)} />
              {notFoundOn ? (
                <Field label="404 page path" htmlFor="ht-404">
                  <Input
                    id="ht-404"
                    value={notFoundPage}
                    onChange={(e) => setNotFoundPage(e.target.value)}
                    placeholder="/404.html"
                    className="font-mono"
                  />
                </Field>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {errors.length ? (
          <Alert tone="error" title="Fix these before copying">
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <OutputBox
          value={output}
          label=".htaccess"
          filename=".htaccess"
          mono
          rows={18}
          placeholder="Choose at least one rule and your .htaccess code appears here."
        />
        <p className="text-sm text-muted">
          Paste the rules at the top of the .htaccess file in your site&apos;s root folder. Requires Apache with mod_rewrite. Back
          up the existing file first.
        </p>
      </div>
    </ToolColumns>
  );
}
