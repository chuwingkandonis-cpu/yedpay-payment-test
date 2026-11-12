import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { EndpointSpec, FieldSpec } from "@/lib/catalog";
import { ResponsePanel, type CallResult } from "./ResponsePanel";
import { useCreds } from "@/lib/creds";
import { usePaymentSettings } from "@/lib/paymentSettings";
import {
  ALLOWED_GATEWAYS,
  ALLOWED_GATEWAY_ADMIN_FEE,
  ALL_ALLOWED_GATEWAY_IDS,
  buildAllowedGateways,
  buildAllowedGatewaysParam,
} from "@/lib/allowedGateways";

const METHOD_TONE: Record<string, string> = {
  GET: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  POST: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  PUT: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  DELETE: "text-red-300 border-red-500/40 bg-red-500/10",
};

function genCustomId() {
  return `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function Field({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  const baseInput =
    "w-full rounded-md border border-[#22303a] bg-[#0d1310] px-3 py-2 font-mono text-sm text-[#d7e3e8] placeholder:text-[#3a4a54] focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors min-h-[44px]";

  return (
    <label className="block">
      <span className="flex items-baseline gap-2 mb-1.5 flex-wrap">
        <span className="font-mono text-xs text-[#9fb4bd]">{spec.label}</span>
        {spec.required && (
          <span className="font-mono text-[10px] text-emerald-400 border border-emerald-500/40 rounded px-1">
            required
          </span>
        )}
        {spec.hint && (
          <span className="text-[11px] text-[#4a5a64]">{spec.hint}</span>
        )}
      </span>
      {spec.type === "select" ? (
        <select
          className={baseInput + " cursor-pointer"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.type === "textarea" ? (
        <textarea
          className={baseInput + " min-h-[84px] resize-y"}
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : spec.type === "switch" ? (
        <button
          type="button"
          role="switch"
          aria-checked={value === "1"}
          onClick={() => onChange(value === "1" ? "" : "1")}
          className={`relative h-[26px] w-[48px] rounded-full border transition-colors cursor-pointer ${
            value === "1"
              ? "bg-emerald-500/30 border-emerald-500/60"
              : "bg-[#0d1310] border-[#22303a]"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[20px] w-[20px] rounded-full transition-all ${
              value === "1" ? "left-[24px] bg-emerald-400" : "left-[3px] bg-[#4a5a64]"
            }`}
          />
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            className={baseInput}
            value={value}
            placeholder={spec.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {spec.auto === "customId" && (
            <button
              type="button"
              onClick={() => onChange(genCustomId())}
              className="shrink-0 px-3 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 transition-colors cursor-pointer min-h-[44px]"
              title="Generate a unique custom_id"
            >
              gen
            </button>
          )}
        </div>
      )}
    </label>
  );
}

function AllowedGatewaysPicker({
  ids,
  onChange,
  mergedPreview,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  mergedPreview: string;
}) {
  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  return (
    <div className="rounded-md border border-[#22303a] bg-[#0b100e] p-3 -mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <span className="font-mono text-xs text-[#9fb4bd]">
          allowed gateways{" "}
          <span className="text-[#4a5a64]">
            — gateway_code is empty, restrict via allowed_gateways
          </span>
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(ALL_ALLOWED_GATEWAY_IDS)}
            className="font-mono text-[11px] text-[#7d94a0] hover:text-emerald-300 cursor-pointer"
          >
            all
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="font-mono text-[11px] text-[#7d94a0] hover:text-emerald-300 cursor-pointer"
          >
            none
          </button>
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {ALLOWED_GATEWAYS.map((g) => {
          const checked = ids.includes(g.id);
          return (
            <label
              key={g.id}
              className={`flex items-start gap-2 rounded border px-2 py-1.5 cursor-pointer transition-colors ${
                checked
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-[#22303a] hover:border-[#2f4250]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(g.id)}
                className="mt-0.5 accent-emerald-500 cursor-pointer"
              />
              <span className="min-w-0">
                <span className="block font-mono text-xs text-[#d7e3e8] break-words">
                  {g.label}
                </span>
                <span className="block text-[10px] text-[#4a5a64] leading-snug">
                  fee {ALLOWED_GATEWAY_ADMIN_FEE}
                  {g.mobileShowQrcode ? " · mobile QR" : ""}
                  {g.specificGateway ? ` · only ${g.specificGateway.join("/")}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {ids.length > 0 ? (
        <p className="mt-2 font-mono text-[11px] text-[#7d94a0] break-all leading-relaxed">
          <span className="text-[#4a5a64]">allowed_gateways → </span>
          {mergedPreview}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-400/80">
          No gateways ticked — allowed_gateways is not sent, checkout shows
          everything on the account.
        </p>
      )}
    </div>
  );
}

export function EndpointRunner({ spec }: { spec: EndpointSpec }) {
  const creds = useCreds();
  const utils = trpc.useUtils();
  const { syncFromForm } = usePaymentSettings();

  const defaults = useMemo(() => {
    const d: Record<string, string> = {};
    for (const f of spec.fields) d[f.name] = f.default ?? "";
    if (spec.key === "createPaymentLink") {
      d.customId = genCustomId();
      d.returnUrl = `${window.location.origin}/?payment=success`;
      d.returnUrlFailed = `${window.location.origin}/?payment=failed`;
      d.notifyUrl = `${window.location.origin}/api/yedpay/notify`;
    }
    return d;
  }, [spec]);

  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [allowedIds, setAllowedIds] = useState<string[]>(ALL_ALLOWED_GATEWAY_IDS);
  const [result, setResult] = useState<CallResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(defaults);
    setAllowedIds(ALL_ALLOWED_GATEWAY_IDS);
    setResult(null);
    setValidationError(null);
  }, [defaults]);

  // Allowed gateways only apply when gateway_code is empty
  // ("All available gateways"). Ticking gateways fills the
  // allowed_gateways parameter (auto-synced into the raw field, editable).
  const showAllowedGateways =
    spec.key === "createPaymentLink" && !(values.gatewayCode ?? "").trim();

  useEffect(() => {
    if (!showAllowedGateways) return;
    const param = buildAllowedGatewaysParam(allowedIds);
    setValues((s) => (s.allowedGateways === param ? s : { ...s, allowedGateways: param }));
  }, [showAllowedGateways, allowedIds]);

  // Keep the shared Demo Store payment config in sync with this form.
  useEffect(() => {
    if (spec.key === "createPaymentLink") syncFromForm(values);
  }, [spec.key, values, syncFromForm]);

  const mutations = {
    createPaymentLink: trpc.yedpay.createPaymentLink.useMutation(),
    queryPayment: trpc.yedpay.queryPayment.useMutation(),
    refundByCustomId: trpc.yedpay.refundByCustomId.useMutation(),
    refundByTransactionId: trpc.yedpay.refundByTransactionId.useMutation(),
    listAuthorizations: trpc.yedpay.listAuthorizations.useMutation(),
    getAuthorization: trpc.yedpay.getAuthorization.useMutation(),
    captureAuthorization: trpc.yedpay.captureAuthorization.useMutation(),
    cancelAuthorization: trpc.yedpay.cancelAuthorization.useMutation(),
    incrementalAuthorization: trpc.yedpay.incrementalAuthorization.useMutation(),
    customRequest: trpc.yedpay.customRequest.useMutation(),
  } as const;

  const mutation = mutations[spec.key as keyof typeof mutations];
  const pending = mutation.isPending;

  const run = async () => {
    setValidationError(null);
    for (const f of spec.fields) {
      if (f.required && !values[f.name]?.trim()) {
        setValidationError(`「${f.label}」is required`);
        return;
      }
    }

    const credPayload = {
      environment: creds.environment,
      apiKey: creds.apiKey,
      signKey: creds.signKey,
    };

    let input: Record<string, unknown> = { ...credPayload };
    if (spec.key === "customRequest") {
      let params: Record<string, string> = {};
      const raw = values.params?.trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            params = Object.fromEntries(
              Object.entries(parsed).map(([k, v]) => [
                k,
                typeof v === "string" ? v : JSON.stringify(v),
              ]),
            );
          } else {
            setValidationError("params must be a JSON object");
            return;
          }
        } catch {
          setValidationError("params is not valid JSON");
          return;
        }
      }
      input = { ...credPayload, method: values.method || "GET", path: values.path, params };
    } else {
      for (const f of spec.fields) {
        const v = values[f.name];
        if (f.type === "switch") {
          if (v === "1") input[f.name] = true;
        } else if (v?.trim()) {
          input[f.name] = v.trim();
        }
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = (await (mutation as any).mutateAsync(input)) as CallResult;
      setResult(res);
      utils.yedpay.history.invalidate().catch(() => {});
    } catch (err) {
      setResult({
        ok: false,
        httpStatus: 0,
        url: "",
        method: spec.method,
        requestBody: "",
        responseText: err instanceof Error ? err.message : String(err),
        responseJson: null,
        durationMs: 0,
      });
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* request */}
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span
            className={`font-mono text-xs font-bold px-2 py-1 rounded border ${METHOD_TONE[spec.method]}`}
          >
            {spec.method}
          </span>
          <code className="font-mono text-sm text-[#d7e3e8] break-all">
            {spec.path}
          </code>
        </div>
        <p className="text-sm text-[#7d94a0] mb-5 leading-relaxed">
          {spec.description}
        </p>

        <div className="space-y-4">
          {spec.fields.map((f) => (
            <div key={f.name} className="space-y-3">
              <Field
                spec={f}
                value={values[f.name] ?? ""}
                onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
              />
              {f.name === "gatewayCode" && showAllowedGateways && (
                <AllowedGatewaysPicker
                  ids={allowedIds}
                  onChange={setAllowedIds}
                  mergedPreview={
                    values.allowedGateways ||
                    JSON.stringify(buildAllowedGateways(allowedIds))
                  }
                />
              )}
            </div>
          ))}
        </div>

        {validationError && (
          <p className="mt-4 text-sm text-red-400 font-mono">
            ✕ {validationError}
          </p>
        )}

        <button
          type="button"
          onClick={run}
          disabled={pending || !creds.loaded}
          className="mt-6 w-full min-h-[48px] rounded-md bg-emerald-500 font-semibold text-[#06231a] text-sm tracking-wide hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-[#06231a]/40 border-t-[#06231a] animate-spin" />
              Sending…
            </span>
          ) : (
            `Send ${spec.method} request`
          )}
        </button>
      </div>

      {/* response */}
      <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <ResponsePanel result={result} apiKey={creds.apiKey} />
      </div>
    </div>
  );
}
