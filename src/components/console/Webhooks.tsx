import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { JsonView } from "./JsonView";

export function Webhooks() {
  const utils = trpc.useUtils();
  const notifications = trpc.yedpay.notifications.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const clear = trpc.yedpay.clearNotifications.useMutation({
    onSuccess: () => utils.yedpay.notifications.invalidate(),
  });
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const notifyUrl = `${window.location.origin}/api/yedpay/notify`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Async Notification Receiver</h2>
        <p className="text-sm text-[#7d94a0] leading-relaxed">
          Yedpay POSTs a signed urlencoded payload to your{" "}
          <code className="font-mono text-emerald-300">notify_url</code> when a
          transaction finishes. This page lists every notification received here
          (auto-refreshes every 5s) and verifies each HMAC-SHA256 signature
          against your sign key.
        </p>
      </div>

      <div className="rounded-lg border border-[#1f2a30] bg-[#0b100e] p-4">
        <div className="font-mono text-xs text-[#4a5a64] mb-2">
          YOUR NOTIFY_URL — use this in Create Payment Link
        </div>
        <div className="flex gap-2 flex-wrap">
          <code className="flex-1 min-w-0 font-mono text-sm text-emerald-300 break-all rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            {notifyUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(notifyUrl).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="px-4 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 transition-colors cursor-pointer min-h-[44px]"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#4a5a64] font-mono">
          Note: Yedpay only allows ports 80/443 — the URL works once the site is
          published to its public address, or from this preview if it is
          publicly reachable.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm text-[#9fb4bd]">
          Received notifications ({notifications.data?.length ?? 0})
        </h3>
        <button
          type="button"
          onClick={() => clear.mutate()}
          className="px-3 py-1.5 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-red-300 hover:border-red-500/50 transition-colors cursor-pointer min-h-[36px]"
        >
          clear
        </button>
      </div>

      {notifications.data?.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#1f2a30] py-12 text-center text-sm text-[#4a5a64]">
          No notifications yet — create a payment with this notify_url and
          complete it.
        </div>
      )}

      <div className="space-y-2">
        {notifications.data?.map((n) => {
          let parsed: unknown = null;
          try {
            parsed = n.parsedBody ? JSON.parse(n.parsedBody) : null;
          } catch {
            parsed = null;
          }
          const isOpen = expanded === n.id;
          return (
            <div
              key={n.id}
              className="rounded-lg border border-[#1f2a30] bg-[#0b100e] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : n.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer min-h-[52px]"
              >
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                    n.signValid
                      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                      : "text-red-300 border-red-500/40 bg-red-500/10"
                  }`}
                >
                  {n.signValid ? "SIGN ✓" : "SIGN ✕"}
                </span>
                <span className="font-mono text-xs text-[#7dcfff] shrink-0">
                  {n.requestType ?? "—"}
                </span>
                <span className="font-mono text-xs text-[#9fb4bd] truncate flex-1">
                  {n.customId ?? ""}
                </span>
                <span className="font-mono text-xs text-amber-300 shrink-0">
                  {n.txnStatus ?? ""}
                </span>
                <span className="font-mono text-[11px] text-[#4a5a64] shrink-0 hidden sm:block">
                  {n.createdAt
                    ? new Date(n.createdAt).toLocaleTimeString()
                    : ""}
                </span>
                <span className="text-[#4a5a64] text-xs">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[#1f2a30] p-4 space-y-3">
                  <div>
                    <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                      PARSED PAYLOAD
                    </div>
                    <JsonView data={parsed ?? n.rawBody} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                      RAW BODY
                    </div>
                    <pre className="font-mono text-[11px] text-[#7d94a0] whitespace-pre-wrap break-all bg-black/30 rounded p-2 max-h-40 overflow-auto">
                      {n.rawBody}
                    </pre>
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
