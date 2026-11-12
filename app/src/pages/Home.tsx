import { useMemo, useState } from "react";
import { ENDPOINTS, GROUPS } from "@/lib/catalog";
import { EndpointRunner } from "@/components/console/EndpointRunner";
import { DemoStore } from "@/components/console/DemoStore";
import { Webhooks } from "@/components/console/Webhooks";
import { Verifier } from "@/components/console/Verifier";
import { History } from "@/components/console/History";
import { useCreds, maskKey } from "@/lib/creds";

type View = string; // endpoint key | "store" | "webhooks" | "verifier" | "history"

const TOOL_VIEWS = [
  { key: "webhooks", label: "Webhook Log" },
  { key: "verifier", label: "Signature Verifier" },
  { key: "history", label: "Call History" },
];

function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const creds = useCreds();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0b100e] border-l border-[#1f2a30] p-6 overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Credentials</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-md border border-[#22303a] text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="font-mono text-xs text-[#9fb4bd] mb-2">
              ENVIRONMENT
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["production", "staging"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => creds.setEnvironment(env)}
                  className={`min-h-[44px] rounded-md border font-mono text-sm transition-colors cursor-pointer ${
                    creds.environment === env
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-[#22303a] text-[#7d94a0] hover:border-emerald-500/40"
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[#4a5a64] font-mono">
              {creds.environment === "production"
                ? "https://api.yedpay.com/v1"
                : "https://api-staging.yedpay.com/v1"}
            </p>
          </div>

          <label className="block">
            <span className="font-mono text-xs text-[#9fb4bd] block mb-2">
              API KEY
            </span>
            <textarea
              value={creds.apiKey}
              onChange={(e) => creds.setApiKey(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[#22303a] bg-[#0d1310] px-3 py-2 font-mono text-xs text-[#d7e3e8] focus:outline-none focus:border-emerald-500/60 transition-colors resize-y"
            />
            <span className="text-[11px] text-[#4a5a64]">
              Sent as header: Authorization: API-KEY …
            </span>
          </label>

          <label className="block">
            <span className="font-mono text-xs text-[#9fb4bd] block mb-2">
              SIGN KEY (HMAC-SHA256, 32 chars)
            </span>
            <input
              value={creds.signKey}
              onChange={(e) => creds.setSignKey(e.target.value)}
              className="w-full rounded-md border border-[#22303a] bg-[#0d1310] px-3 py-2 font-mono text-xs text-[#d7e3e8] focus:outline-none focus:border-emerald-500/60 transition-colors min-h-[44px]"
            />
            <span className="text-[11px] text-[#4a5a64]">
              Used to verify async-notification signatures.
            </span>
          </label>

          <p className="text-[11px] text-[#4a5a64] leading-relaxed border-t border-[#1f2a30] pt-4">
            Keys are pre-filled from the server's environment and editable here
            for this session only — they never leave the page except inside the
            API calls you trigger.
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const [view, setView] = useState<View>("createPaymentLink");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const creds = useCreds();

  const paymentResult = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("payment");
    return p === "success" || p === "failed" ? p : null;
  }, []);

  const endpoint = ENDPOINTS.find((e) => e.key === view);

  const navButton = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setView(key)}
      className={`w-full text-left px-3 py-2 rounded-md font-mono text-[13px] transition-colors cursor-pointer min-h-[40px] ${
        view === key
          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
          : "text-[#7d94a0] hover:text-[#d7e3e8] hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      {label}
    </button>
  );

  const travelLink = (className: string) => (
    <a
      key="travel"
      href="/travel"
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      ✈ Travel Insurance ↗
    </a>
  );

  const nav = (
    <>
      <div className="mb-5">
        <div className="px-3 mb-1.5 font-mono text-[10px] tracking-[0.18em] text-[#4a5a64] uppercase">
          Playground
        </div>
        <div className="space-y-0.5">
          {navButton("store", "Demo Store")}
          {travelLink(
            "block w-full text-left px-3 py-2 rounded-md font-mono text-[13px] transition-colors min-h-[40px] text-sky-300/90 hover:text-sky-200 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/30",
          )}
        </div>
      </div>
      {GROUPS.filter((g) => g !== "Tools").map((group) => (
        <div key={group} className="mb-5">
          <div className="px-3 mb-1.5 font-mono text-[10px] tracking-[0.18em] text-[#4a5a64] uppercase">
            {group}
          </div>
          <div className="space-y-0.5">
            {ENDPOINTS.filter((e) => e.group === group).map((e) =>
              navButton(e.key, e.label),
            )}
          </div>
        </div>
      ))}
      <div className="mb-5">
        <div className="px-3 mb-1.5 font-mono text-[10px] tracking-[0.18em] text-[#4a5a64] uppercase">
          Tools
        </div>
        <div className="space-y-0.5">
          {ENDPOINTS.filter((e) => e.group === "Tools").map((e) =>
            navButton(e.key, e.label),
          )}
          {TOOL_VIEWS.map((t) => navButton(t.key, t.label))}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh flex flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-[#1f2a30] bg-[#070a09]/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono font-bold text-emerald-400 text-lg leading-none">
              {"❯"}
            </span>
            <span className="font-semibold tracking-tight truncate">
              Yedpay API Console
            </span>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() =>
              creds.setEnvironment(
                creds.environment === "production" ? "staging" : "production",
              )
            }
            className={`hidden sm:block font-mono text-[11px] px-2.5 py-1.5 rounded border transition-colors cursor-pointer min-h-[36px] ${
              creds.environment === "production"
                ? "text-red-300 border-red-500/40 bg-red-500/10"
                : "text-sky-300 border-sky-500/40 bg-sky-500/10"
            }`}
            title="Click to switch environment"
          >
            {creds.environment.toUpperCase()}
          </button>
          <span className="hidden md:inline font-mono text-[11px] text-[#4a5a64]">
            key {maskKey(creds.apiKey)}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="px-3 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 transition-colors cursor-pointer min-h-[36px]"
          >
            keys ⚙
          </button>
        </div>
        {/* mobile nav */}
        <div className="lg:hidden overflow-x-auto border-t border-[#1f2a30]">
          <div className="flex gap-1 px-2 py-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setView("store")}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] whitespace-nowrap cursor-pointer min-h-[36px] ${
                view === "store"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                  : "text-[#7d94a0] border border-transparent"
              }`}
            >
              Demo Store
            </button>
            <a
              href="/travel"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md font-mono text-[11px] whitespace-nowrap min-h-[36px] text-sky-300/90 border border-transparent inline-flex items-center"
            >
              ✈ Travel Insurance ↗
            </a>
            {ENDPOINTS.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setView(e.key)}
                className={`px-3 py-1.5 rounded-md font-mono text-[11px] whitespace-nowrap cursor-pointer min-h-[36px] ${
                  view === e.key
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "text-[#7d94a0] border border-transparent"
                }`}
              >
                {e.label}
              </button>
            ))}
            {TOOL_VIEWS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={`px-3 py-1.5 rounded-md font-mono text-[11px] whitespace-nowrap cursor-pointer min-h-[36px] ${
                  view === t.key
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "text-[#7d94a0] border border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-[#1f2a30] bg-[#070a09] p-3 overflow-y-auto">
          {nav}
          <div className="mt-6 px-3 pt-4 border-t border-[#1f2a30] font-mono text-[10px] text-[#3a4a54] leading-relaxed">
            Docs: api-staging.yedpay.com
            <br />
            Base: https://api-staging.yedpay.com/v1
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {paymentResult && (
            <div
              className={`mb-5 rounded-lg border px-4 py-3 text-sm font-mono ${
                paymentResult === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {paymentResult === "success"
                ? "← Returned from checkout: payment finished. Use Query Payment with your custom_id to confirm the status."
                : "← Returned from checkout: payment failed / cancelled / expired."}
            </div>
          )}

          {endpoint && <EndpointRunner key={endpoint.key} spec={endpoint} />}
          {view === "store" && <DemoStore />}
          {view === "webhooks" && <Webhooks />}
          {view === "verifier" && <Verifier />}
          {view === "history" && <History />}
        </main>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function Home() {
  return <Shell />;
}
