import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useCreds } from "@/lib/creds";
import { JsonView } from "./JsonView";

const SAMPLE = `success=1&request_type=purchase&transaction[id]=xxxxxxxxxxxxxxx&transaction[transaction_id]=xxxxxxxxxxxxxxxxx&transaction[gateway_code]=12_1&transaction[custom_id]=test-001&transaction[payment_method]=VISA Online&transaction[currency]=HKD&transaction[amount]=5.00&transaction[status]=paid&transaction[paid_at]=2018-07-12+16%3A00%3A43&transaction[updated_at]=2018-07-12+16%3A07%3A56&nonce_str=1pt0Elsxiww0BSrqrE5PYqKiQYnRLKCzfZZ3y3SMvBHuDBFuz4MDbyEF410yyj4b&sign_type=HMAC_SHA256&sign=42bc1ba8efe2816c54ec989645ed5cda84e7b272c3fe60a343e87c81e40793b0`;

export function Verifier() {
  const creds = useCreds();
  const [raw, setRaw] = useState("");
  const verify = trpc.yedpay.verifyNotification.useMutation();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Signature Verifier</h2>
        <p className="text-sm text-[#7d94a0] leading-relaxed">
          Paste a raw notification body (urlencoded) to verify its{" "}
          <code className="font-mono text-emerald-300">sign</code> with your
          sign key. Algorithm: drop <code className="font-mono">sign</code> /{" "}
          <code className="font-mono">sign_type</code>, sort top-level fields,
          PHP-style query string → URL-decode → HMAC-SHA256 (hex).
        </p>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="success=1&request_type=purchase&transaction[id]=…&sign=…"
        className="w-full min-h-[140px] rounded-lg border border-[#22303a] bg-[#0d1310] px-3 py-2.5 font-mono text-xs text-[#d7e3e8] placeholder:text-[#3a4a54] focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors"
      />

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => raw.trim() && verify.mutate({ rawBody: raw })}
          disabled={verify.isPending || !raw.trim()}
          className="px-5 min-h-[44px] rounded-md bg-emerald-500 font-semibold text-[#06231a] text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
        >
          Verify signature
        </button>
        <button
          type="button"
          onClick={() => setRaw(SAMPLE)}
          className="px-4 min-h-[44px] rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 transition-colors cursor-pointer"
        >
          load doc sample
        </button>
      </div>

      {verify.data && (
        <div className="rounded-lg border border-[#1f2a30] bg-[#0b100e] p-4 space-y-4">
          <div
            className={`inline-flex font-mono text-xs font-bold px-2.5 py-1 rounded border ${
              verify.data.valid
                ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                : "text-red-300 border-red-500/40 bg-red-500/10"
            }`}
          >
            {verify.data.valid
              ? "SIGNATURE VALID ✓"
              : "SIGNATURE MISMATCH ✕ (expected with the doc sample — its key differs)"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                RECEIVED SIGN
              </div>
              <code className="block font-mono text-[11px] text-amber-300 break-all bg-black/30 rounded p-2">
                {verify.data.receivedSign || "(none)"}
              </code>
            </div>
            <div>
              <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
                COMPUTED SIGN (key {creds.signKey ? "••••" + creds.signKey.slice(-4) : "not set"})
              </div>
              <code className="block font-mono text-[11px] text-emerald-300 break-all bg-black/30 rounded p-2">
                {verify.data.computedSign}
              </code>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
              STRING-TO-SIGN (sorted, urldecoded)
            </div>
            <pre className="font-mono text-[11px] text-[#7d94a0] whitespace-pre-wrap break-all bg-black/30 rounded p-2 max-h-48 overflow-auto">
              {verify.data.sourceString}
            </pre>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#4a5a64] mb-1">
              PARSED FIELDS
            </div>
            <JsonView data={verify.data.parsed} />
          </div>
        </div>
      )}
    </div>
  );
}
