"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ErrorText, OutputBox, Panel, Segmented, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { buildRobotsTxt, isHttpUrl, type RobotsGroup, type RobotsRule } from "@/tools/lib/seo";

interface RuleRow extends RobotsRule {
  id: string;
}

interface CrawlerGroup {
  id: string;
  /** One of CRAWLERS, or CUSTOM_AGENT when `custom` holds the name. */
  agent: string;
  custom: string;
  rules: RuleRow[];
}

interface SitemapRow {
  id: string;
  url: string;
}

const CUSTOM_AGENT = "__custom";

const CRAWLERS: Array<{ group: string; agents: string[] }> = [
  {
    group: "Search engines",
    agents: [
      "Googlebot",
      "Googlebot-Image",
      "Googlebot-News",
      "Bingbot",
      "Slurp",
      "DuckDuckBot",
      "Baiduspider",
      "YandexBot",
      "Applebot",
    ],
  },
  {
    group: "AI crawlers",
    agents: [
      "GPTBot",
      "ChatGPT-User",
      "OAI-SearchBot",
      "Google-Extended",
      "CCBot",
      "anthropic-ai",
      "ClaudeBot",
      "PerplexityBot",
      "Bytespider",
      "Applebot-Extended",
      "meta-externalagent",
      "Amazonbot",
    ],
  },
  {
    group: "Social & SEO tools",
    agents: ["facebookexternalhit", "Twitterbot", "LinkedInBot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"],
  },
];

const AI_CRAWLERS = CRAWLERS[1].agents;
const ADMIN_RULES: RobotsRule[] = [
  { type: "disallow", path: "/admin/" },
  { type: "disallow", path: "/wp-admin/" },
  { type: "allow", path: "/wp-admin/admin-ajax.php" },
  { type: "disallow", path: "/login/" },
  { type: "disallow", path: "/cgi-bin/" },
];

/** What the generator shows before the visitor changes anything; not counted as a use. */
const STARTING_OUTPUT = buildRobotsTxt([{ userAgent: "*", rules: [], crawlDelay: null }], []);

const newId = () => crypto.randomUUID();
const toRow = (rule: RobotsRule): RuleRow => ({ ...rule, id: newId() });

function agentName(group: CrawlerGroup): string {
  return group.agent === CUSTOM_AGENT ? group.custom.trim() : group.agent;
}

/** Editable list of Allow / Disallow paths. */
function RuleList({ rules, onChange, label }: { rules: RuleRow[]; onChange: (rules: RuleRow[]) => void; label: string }) {
  const update = (id: string, patch: Partial<RobotsRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rules.map((rule, index) => (
        <div key={rule.id} className="flex gap-2">
          <Select
            aria-label={`${label}: rule ${index + 1} type`}
            value={rule.type}
            onChange={(e) => update(rule.id, { type: e.target.value as RobotsRule["type"] })}
            className="w-32 shrink-0"
          >
            <option value="disallow">Disallow</option>
            <option value="allow">Allow</option>
          </Select>
          <Input
            aria-label={`${label}: rule ${index + 1} path`}
            value={rule.path}
            onChange={(e) => update(rule.id, { path: e.target.value })}
            placeholder="/private/"
            className="min-w-0 font-mono"
          />
          <Button
            variant="ghost"
            size="md"
            className="shrink-0 px-2.5"
            aria-label={`Remove rule ${index + 1}`}
            onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rules, toRow({ type: "disallow", path: "" })])}>
        <Plus aria-hidden />
        Add path
      </Button>
    </div>
  );
}

export default function RobotsTxtGenerator() {
  const { track } = useTool();
  const [defaultRule, setDefaultRule] = useState<"allow" | "disallow">("allow");
  const [defaultPaths, setDefaultPaths] = useState<RuleRow[]>([]);
  const [crawlDelay, setCrawlDelay] = useState("");
  const [groups, setGroups] = useState<CrawlerGroup[]>([]);
  const [sitemaps, setSitemaps] = useState<SitemapRow[]>(() => [{ id: newId(), url: "" }]);

  const delay = crawlDelay.trim() ? Number(crawlDelay) : null;
  const delayInvalid = delay !== null && (!Number.isFinite(delay) || delay <= 0 || delay > 3600);
  const badSitemaps = sitemaps.filter((s) => s.url.trim() && !isHttpUrl(s.url.trim()));

  const output = useMemo(() => {
    const all: RobotsGroup[] = [
      {
        userAgent: "*",
        rules: [...(defaultRule === "disallow" ? [{ type: "disallow" as const, path: "/" }] : []), ...defaultPaths],
        crawlDelay: delayInvalid ? null : delay,
      },
      ...groups.filter((g) => agentName(g)).map((g) => ({ userAgent: agentName(g), rules: g.rules, crawlDelay: null })),
    ];
    return buildRobotsTxt(
      all,
      sitemaps.map((s) => s.url).filter((url) => isHttpUrl(url.trim())),
    );
  }, [defaultRule, defaultPaths, delay, delayInvalid, groups, sitemaps]);

  useEffect(() => {
    if (output !== STARTING_OUTPUT) track();
  }, [output, track]);

  const updateGroup = (id: string, patch: Partial<CrawlerGroup>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  function blockAiCrawlers() {
    setGroups((prev) => {
      const present = new Set(prev.map(agentName));
      const added = AI_CRAWLERS.filter((a) => !present.has(a)).map((agent) => ({
        id: newId(),
        agent,
        custom: "",
        rules: [toRow({ type: "disallow", path: "/" })],
      }));
      return [...prev, ...added];
    });
  }

  function blockAdminFolders() {
    setDefaultPaths((prev) => {
      const present = new Set(prev.map((r) => `${r.type} ${r.path.trim()}`));
      return [...prev, ...ADMIN_RULES.filter((r) => !present.has(`${r.type} ${r.path}`)).map(toRow)];
    });
  }

  function reset() {
    setDefaultRule("allow");
    setDefaultPaths([]);
    setCrawlDelay("");
    setGroups([]);
    setSitemaps([{ id: newId(), url: "" }]);
  }

  return (
    <ToolColumns>
      <div className="space-y-4">
        <Panel
          title="Presets"
          actions={
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={blockAiCrawlers}>
              Block AI crawlers
            </Button>
            <Button variant="secondary" size="sm" onClick={blockAdminFolders}>
              Block admin folders
            </Button>
          </div>
        </Panel>

        <Panel title="All crawlers (User-agent: *)">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Default rule</p>
              <Segmented
                label="Default rule"
                value={defaultRule}
                onChange={setDefaultRule}
                options={[
                  { value: "allow", label: "Allow all" },
                  { value: "disallow", label: "Disallow all" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                {defaultRule === "allow" ? "Paths to block or allow" : "Paths to allow anyway"}
              </p>
              <RuleList rules={defaultPaths} onChange={setDefaultPaths} label="All crawlers" />
            </div>
            <Field
              label="Crawl-delay (seconds)"
              htmlFor="robots-delay"
              hint={
                delayInvalid
                  ? "Enter a number of seconds between 1 and 3600."
                  : "Optional. Bing and Yandex respect it; Google ignores it."
              }
            >
              <Input
                id="robots-delay"
                type="number"
                inputMode="numeric"
                min={1}
                max={3600}
                value={crawlDelay}
                onChange={(e) => setCrawlDelay(e.target.value)}
                placeholder="None"
                aria-invalid={delayInvalid}
                className="sm:w-40"
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Rules for specific crawlers"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setGroups((prev) => [
                  ...prev,
                  { id: newId(), agent: "Googlebot", custom: "", rules: [toRow({ type: "disallow", path: "" })] },
                ])
              }
            >
              <Plus aria-hidden />
              Add crawler
            </Button>
          }
        >
          {groups.length ? (
            <ul className="space-y-4">
              {groups.map((group, index) => {
                const selectId = `robots-agent-${group.id}`;
                return (
                  <li key={group.id} className="rounded-lg border border-line p-3">
                    <div className="mb-3 flex flex-wrap items-end gap-2">
                      <Field label={`Crawler ${index + 1}`} htmlFor={selectId} className="min-w-0 flex-1">
                        <Select
                          id={selectId}
                          value={group.agent}
                          onChange={(e) => updateGroup(group.id, { agent: e.target.value })}
                        >
                          {CRAWLERS.map((c) => (
                            <optgroup key={c.group} label={c.group}>
                              {c.agents.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value={CUSTOM_AGENT}>Other (type a name)</option>
                        </Select>
                      </Field>
                      <Button
                        variant="ghost"
                        aria-label={`Remove crawler ${index + 1}`}
                        onClick={() => setGroups((prev) => prev.filter((g) => g.id !== group.id))}
                      >
                        <Trash2 aria-hidden />
                        Remove
                      </Button>
                    </div>
                    {group.agent === CUSTOM_AGENT ? (
                      <Field label="User-agent name" htmlFor={`${selectId}-custom`} className="mb-3">
                        <Input
                          id={`${selectId}-custom`}
                          value={group.custom}
                          onChange={(e) => updateGroup(group.id, { custom: e.target.value })}
                          placeholder="ExampleBot"
                        />
                      </Field>
                    ) : null}
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateGroup(group.id, { rules: [toRow({ type: "disallow", path: "/" })] })}
                      >
                        Block entire site
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateGroup(group.id, { rules: [toRow({ type: "allow", path: "/" })] })}
                      >
                        Allow entire site
                      </Button>
                    </div>
                    <RuleList
                      rules={group.rules}
                      onChange={(rules) => updateGroup(group.id, { rules })}
                      label={agentName(group) || `Crawler ${index + 1}`}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No crawler-specific rules. Every crawler follows the rules above.</p>
          )}
        </Panel>

        <Panel title="Sitemaps">
          <div className="space-y-2">
            {sitemaps.map((s, index) => (
              <div key={s.id} className="flex gap-2">
                <Input
                  type="url"
                  inputMode="url"
                  aria-label={`Sitemap URL ${index + 1}`}
                  value={s.url}
                  onChange={(e) => setSitemaps((prev) => prev.map((p) => (p.id === s.id ? { ...p, url: e.target.value } : p)))}
                  placeholder="https://example.com/sitemap.xml"
                  aria-invalid={Boolean(s.url.trim() && !isHttpUrl(s.url.trim()))}
                  className="min-w-0"
                />
                <Button
                  variant="ghost"
                  className="shrink-0 px-2.5"
                  aria-label={`Remove sitemap ${index + 1}`}
                  onClick={() => setSitemaps((prev) => prev.filter((p) => p.id !== s.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <ErrorText>{badSitemaps.length ? "Sitemap URLs must be full addresses starting with https://" : null}</ErrorText>
            <Button variant="outline" size="sm" onClick={() => setSitemaps((prev) => [...prev, { id: newId(), url: "" }])}>
              <Plus aria-hidden />
              Add sitemap
            </Button>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <OutputBox value={output} label="robots.txt" filename="robots.txt" mono rows={18} />
        <p className="text-sm text-muted">
          Upload the file to the root of your site so it is available at{" "}
          <span className="font-mono">https://your-site.com/robots.txt</span>. Blocking a page stops crawling, not indexing; use a
          noindex meta tag to keep a page out of search results.
        </p>
      </div>
    </ToolColumns>
  );
}
