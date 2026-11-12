import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { JsonView } from "./JsonView";

const METHOD_TONE: Record<string, string> = {
  GET: "text-sky-300 border-sky-500/40",
  POST: "text-emerald-300 border-emerald-500/40",
  PUT: "text-amber-300 border-amber-500/40",
  DELETE: "text-red-300 border-red-500/40",
};

export function History() {
  const utils = trpc.useUtils();
  const history = trpc.yedpay.history.useQuery();
  const clear = trpc.yedpay.clearHistory.useMutation({
    onSuccess: () => utils.yedpay.history.invalidate(),
  });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold mb-1">Call History</h2>
          <p className="text-sm text-[#7d94a0]">
            The last 50 API calls sent from this console, newest first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => clear.mutate()}
          className="px-3 py-1.5 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-red-300 hover:border-red-500/50 transition-colors cursor-pointer min-h-[36px]"
        >
          clear
        </button>
      </div>

      {history.data?.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#1f2a30] py-12 text-center text-sm text-[#4a5a64]">
          No calls yet — run any endpoint from the sidebar.
        </div>
      )}

      <div className="space-y-2">
        {history.data?.map((h) => {
          const isOpen = expanded === h.id;
          let parsed: unknown = null;
          try {
            parsed = h.responseBody ? JSON.parse(h.responseBody) : null;
          } catch {
            parsed = null;
          }
          return (
            <div
              key={h.id}
              className="rounded-lg border border-[#1f2a30] bg-[#0b100e] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : h.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer min-h-[52px]"
              >
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${METHOD_TONE[h.method] ?? "text-[#7d94a0] border-[#22303a]"}`}
                >
                  {h.method}
                </span>
                <span className="text-xs text-[#9fb4bd] shrink-0 hidden md:block w-44 truncate">
                  {h.label}
                </span>
                <span className="font-mono text-[11px] text-[#4a5a64] truncate flex-1">
                  {h.url.replace(/^https?:\/\//, "")}
                </span>
                <span
                  className={`font-mono text-xs shrink-0 ${
                    h.httpStatus && h.httpStatus < 300
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {h.httpStatus ?? "ERR"}
                </span>
                <span className="font-mono text-[11px] text-[#4a5a64] shrink-0 hidden sm:block">
                  {h.createdAt ? new Date(h.createdAt).toLocaleTimeString() : ""}
                </span>
                <span className="text-[#4a5a64] text-xs">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[#1f2a30] p-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                      REQUEST BODY
                    </div>
                    <pre className="font-mono text-[11px] text-[#e0af68] whitespace-pre-wrap break-all bg-black/30 rounded p-2 max-h-56 overflow-auto">
                      {h.requestBody || "(none)"}
                    </pre>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                      RESPONSE ({h.durationMs ?? "?"} ms)
                    </div>
                    <div className="max-h-56 overflow-auto bg-black/30 rounded p-2">
                      {parsed ? (
                        <JsonView data={parsed} />
                      ) : (
                        <pre className="font-mono text-[11px] text-[#c0caf5] whitespace-pre-wrap break-all">
                          {h.responseBody || "(empty)"}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
