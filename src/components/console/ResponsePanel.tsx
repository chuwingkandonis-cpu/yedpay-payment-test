import { useMemo, useState } from "react";
import { JsonView } from "./JsonView";
import { maskKey } from "@/lib/creds";

export interface CallResult {
  ok: boolean;
  httpStatus: number;
  url: string;
  method: string;
  requestBody: string;
  responseText: string;
  responseJson: unknown;
  durationMs: number;
}

function statusTone(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (status >= 400 && status < 500) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-red-400 border-red-500/40 bg-red-500/10";
}

/** Find checkout / qrcode links anywhere in the response payload. */
function extractLinks(data: unknown): { rel: string; href: string }[] {
  const found: { rel: string; href: string }[] = [];
  const walk = (v: unknown, keyPath: string) => {
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, keyPath));
      return;
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (typeof obj.href === "string" && obj.href.startsWith("http")) {
        found.push({
          rel: typeof obj.rel === "string" ? obj.rel : keyPath || "link",
          href: obj.href,
        });
      }
      for (const [k, val] of Object.entries(obj)) walk(val, k);
      return;
    }
    if (
      typeof v === "string" &&
      v.startsWith("http") &&
      /checkout|payment|\/q\//.test(keyPath)
    ) {
      found.push({ rel: keyPath, href: v });
    }
  };
  walk(data, "");
  // de-dupe
  const seen = new Set<string>();
  return found.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

export function ResponsePanel({
  result,
  apiKey,
}: {
  result: CallResult | null;
  apiKey: string;
}) {
  const [tab, setTab] = useState<"pretty" | "raw" | "curl">("pretty");
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(false);

  const links = useMemo(
    () => (result ? extractLinks(result.responseJson) : []),
    [result],
  );

  const curl = useMemo(() => {
    if (!result) return "";
    const key = reveal ? apiKey : maskKey(apiKey);
    const lines = [
      `curl -X ${result.method} '${result.url}'`,
      `  -H 'Authorization: API-KEY ${key}'`,
      `  -H 'Content-Type: application/x-www-form-urlencoded'`,
    ];
    if (result.requestBody) lines.push(`  -d '${result.requestBody}'`);
    return lines.join(" \\\n");
  }, [result, apiKey, reveal]);

  if (!result) {
    return (
      <div className="h-full min-h-[240px] rounded-lg border border-dashed border-[#1f2a30] flex flex-col items-center justify-center gap-2 text-[#4a5a64]">
        <span className="font-mono text-2xl">{"{ }"}</span>
        <span className="text-sm">Send a request to see the response here</span>
      </div>
    );
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="rounded-lg border border-[#1f2a30] bg-[#0b100e] overflow-hidden flex flex-col min-h-[240px]">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#1f2a30] bg-[#0d1310]">
        <span
          className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${statusTone(result.httpStatus)}`}
        >
          {result.httpStatus}
        </span>
        <span className="font-mono text-[11px] text-[#4a5a64]">
          {result.method}
        </span>
        <span className="font-mono text-[11px] text-[#7d94a0] break-all flex-1 min-w-0">
          {result.url}
        </span>
        <span className="font-mono text-[11px] text-[#4a5a64] shrink-0">
          {result.durationMs} ms
        </span>
      </div>

      {/* checkout links */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-[#1f2a30] bg-emerald-500/5">
          {links.map((l) => (
            <span key={l.href} className="inline-flex items-center gap-1.5">
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer"
              >
                ↗ {l.rel}
              </a>
              {l.rel.includes("checkout") && (
                <a
                  href={`/api/yedpay/go?url=${encodeURIComponent(l.href)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open checkout carrying Referer/Origin https://yedpay-test.kimi.pro"
                  className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/15 transition-colors cursor-pointer"
                >
                  ↗ {l.rel} w/ referer
                </a>
              )}
            </span>
          ))}
        </div>
      )}

      {/* tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-[#1f2a30]">
        {(["pretty", "raw", "curl"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-mono rounded-t cursor-pointer transition-colors ${
              tab === t
                ? "bg-[#111815] text-emerald-300 border border-b-0 border-[#1f2a30]"
                : "text-[#4a5a64] hover:text-[#7d94a0]"
            }`}
          >
            {t === "pretty" ? "Response" : t === "raw" ? "Raw" : "cURL"}
          </button>
        ))}
        <div className="flex-1" />
        {tab === "curl" && (
          <button
            type="button"
            onClick={() => setReveal(!reveal)}
            className="px-2 py-1 text-[11px] font-mono text-[#4a5a64] hover:text-[#7d94a0] cursor-pointer"
          >
            {reveal ? "mask key" : "reveal key"}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            copy(
              tab === "curl"
                ? curl
                : tab === "raw"
                  ? result.responseText
                  : JSON.stringify(result.responseJson, null, 2),
            )
          }
          className="px-2 py-1 text-[11px] font-mono text-[#4a5a64] hover:text-emerald-300 cursor-pointer transition-colors"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>

      {/* body */}
      <div className="p-3 overflow-auto max-h-[520px] flex-1">
        {tab === "pretty" &&
          (result.responseJson ? (
            <JsonView data={result.responseJson} />
          ) : (
            <pre className="font-mono text-xs text-[#c0caf5] whitespace-pre-wrap break-all">
              {result.responseText || "(empty body)"}
            </pre>
          ))}
        {tab === "raw" && (
          <pre className="font-mono text-xs text-[#c0caf5] whitespace-pre-wrap break-all">
            {result.responseText || "(empty body)"}
          </pre>
        )}
        {tab === "curl" && (
          <pre className="font-mono text-xs text-[#e0af68] whitespace-pre-wrap break-all">
            {curl}
          </pre>
        )}
      </div>
    </div>
  );
}
