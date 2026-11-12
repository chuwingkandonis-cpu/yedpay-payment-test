import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { DEMO_PRODUCTS } from "@contracts/products";
import { useCreds } from "@/lib/creds";
import { usePaymentSettings, describeSettings } from "@/lib/paymentSettings";

type Cart = Record<string, number>;

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  paid: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  captured: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  refunded: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  failed: "text-red-300 border-red-500/40 bg-red-500/10",
  cancelled: "text-[#7d94a0] border-[#22303a] bg-white/5",
  expired: "text-[#7d94a0] border-[#22303a] bg-white/5",
};

function statusTone(s: string) {
  return STATUS_TONE[s] ?? "text-[#7d94a0] border-[#22303a] bg-white/5";
}

export function DemoStore() {
  const creds = useCreds();
  const { settings } = usePaymentSettings();
  const settingsChips = useMemo(() => describeSettings(settings), [settings]);
  const utils = trpc.useUtils();
  const [cart, setCart] = useState<Cart>({});
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);
  // Editable unit prices (string so the input allows intermediate states)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEMO_PRODUCTS.map((p) => [p.id, p.price.toFixed(2)])),
  );

  const priceOf = (id: string, fallback: number) => {
    const n = parseFloat(prices[id] ?? "");
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : fallback;
  };

  const ordersQuery = trpc.orders.list.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const create = trpc.orders.create.useMutation();
  const refresh = trpc.orders.refresh.useMutation({
    onSettled: () => utils.orders.list.invalidate(),
  });
  const refund = trpc.orders.refund.useMutation({
    onSettled: () => utils.orders.list.invalidate(),
  });

  // Focus the order the customer just returned to from checkout
  const returnedOrder = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("payment");
    const order = params.get("order");
    return outcome && order ? { outcome, order } : null;
  }, []);

  const cartLines = useMemo(
    () =>
      DEMO_PRODUCTS.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => {
        const price = priceOf(p.id, p.price);
        return {
          ...p,
          price,
          qty: cart[p.id],
          subtotal: price * cart[p.id],
        };
      }),
    [cart, prices],
  );
  const total = cartLines.reduce((s, l) => s + l.subtotal, 0);

  const setQty = (id: string, qty: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));

  const placeOrder = async () => {
    setError(null);
    try {
      const res = await create.mutateAsync({
        items: cartLines.map((l) => ({
          productId: l.id,
          qty: l.qty,
          price: l.price,
        })),
        origin: window.location.origin,
        settings,
      });
      if (!res.ok) {
        setError(`${res.error}${res.responseText ? ` — ${res.responseText.slice(0, 300)}` : ""}`);
        return;
      }
      setCart({});
      setLastCreated(res.customId);
      utils.orders.list.invalidate().catch(() => {});
      window.open(res.checkoutUrl, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Demo Store</h2>
        <p className="text-sm text-[#7d94a0] leading-relaxed">
          A miniature storefront wired to Yedpay end-to-end: pick items → place
          order → pay on the real Yedpay checkout → the webhook updates the
          order automatically. Amounts are recomputed server-side; the{" "}
          <code className="font-mono text-emerald-300">custom_id</code> is the
          order number.
        </p>
      </div>

      {returnedOrder && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-mono ${
            returnedOrder.outcome === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {returnedOrder.outcome === "success"
            ? `← Returned from checkout for ${returnedOrder.order}. Status refreshes automatically (webhook or Refresh).`
            : `← Checkout for ${returnedOrder.order} failed / cancelled / expired.`}
        </div>
      )}

      {/* active payment settings from the Create Payment Link panel */}
      <div className="rounded-lg border border-[#1f2a30] bg-[#0b100e] px-4 py-3">
        <div className="font-mono text-[10px] text-[#4a5a64] mb-2">
          PAYMENT CONFIG — mirrors Online Payment › Create Payment Link
        </div>
        <div className="flex flex-wrap gap-1.5">
          {settingsChips.map((chip) => (
            <span
              key={chip}
              className="font-mono text-[11px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/5 text-emerald-300/90"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* products */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DEMO_PRODUCTS.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className={`rounded-lg border p-4 flex flex-col gap-3 transition-colors ${
                qty > 0
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-[#1f2a30] bg-[#0b100e]"
              }`}
            >
              <div className="font-mono text-2xl text-emerald-400/80 leading-none h-8 flex items-center">
                {p.glyph}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-[#4a5a64]">{p.nameZh}</div>
                <label className="mt-1.5 flex items-center gap-1 font-mono text-sm">
                  <span className="text-[#4a5a64] shrink-0">
                    {settings.currency || "HKD"}
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={prices[p.id] ?? ""}
                    onChange={(e) =>
                      setPrices((s) => ({ ...s, [p.id]: e.target.value }))
                    }
                    aria-label={`${p.name} unit price`}
                    className="w-full min-w-0 min-h-[36px] rounded-md border border-[#22303a] bg-[#0d1310] px-2 py-1 text-[#d7e3e8] focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-colors"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty(p.id, qty - 1)}
                  disabled={qty === 0}
                  className="h-11 w-11 rounded-md border border-[#22303a] text-lg text-[#9fb4bd] hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label={`Remove one ${p.name}`}
                >
                  −
                </button>
                <span className="flex-1 text-center font-mono text-sm">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(p.id, qty + 1)}
                  className="h-11 w-11 rounded-md border border-[#22303a] text-lg text-[#9fb4bd] hover:border-emerald-500/50 hover:text-emerald-300 transition-colors cursor-pointer"
                  aria-label={`Add one ${p.name}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* cart + checkout */}
      <div className="rounded-lg border border-[#1f2a30] bg-[#0b100e] p-4">
        {cartLines.length === 0 ? (
          <p className="text-sm text-[#4a5a64] text-center py-4">
            Cart is empty — add some items above.
          </p>
        ) : (
          <div className="space-y-2">
            {cartLines.map((l) => (
              <div
                key={l.id}
                className="flex justify-between font-mono text-sm text-[#9fb4bd]"
              >
                <span>
                  {l.name} × {l.qty}
                </span>
                <span>
                  {settings.currency || "HKD"} {l.subtotal.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-[#1f2a30] pt-2 font-mono font-semibold">
              <span>Total</span>
              <span className="text-emerald-300">
                {settings.currency || "HKD"} {total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs font-mono text-red-400 break-all">✕ {error}</p>
        )}

        <button
          type="button"
          onClick={placeOrder}
          disabled={cartLines.length === 0 || create.isPending || !creds.loaded}
          className="mt-4 w-full min-h-[48px] rounded-md bg-emerald-500 font-semibold text-[#06231a] text-sm tracking-wide hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {create.isPending ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-[#06231a]/40 border-t-[#06231a] animate-spin" />
              Creating payment…
            </span>
          ) : (
            `Place order & pay ${total > 0 ? `${settings.currency || "HKD"} ${total.toFixed(2)}` : ""}`
          )}
        </button>
        <p className="mt-2 text-[11px] text-[#4a5a64] font-mono text-center">
          Creates the order, then opens the Yedpay checkout in a new tab.
        </p>
      </div>

      {/* orders */}
      <div>
        <h3 className="font-mono text-sm text-[#9fb4bd] mb-3">
          Orders ({ordersQuery.data?.length ?? 0}) — auto-refresh every 5s
        </h3>
        {ordersQuery.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#1f2a30] py-10 text-center text-sm text-[#4a5a64]">
            No orders yet.
          </div>
        )}
        <div className="space-y-2">
          {ordersQuery.data?.map((o) => {
            let lines: { name: string; qty: number; price: number }[] = [];
            try {
              lines = JSON.parse(o.items);
            } catch {
              lines = [];
            }
            const isNew = lastCreated === o.customId;
            return (
              <div
                key={o.id}
                className={`rounded-lg border p-4 bg-[#0b100e] ${
                  isNew ? "border-emerald-500/50" : "border-[#1f2a30]"
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs text-[#7dcfff]">
                    {o.customId}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${statusTone(o.status)}`}
                  >
                    {o.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-sm text-[#d7e3e8] ml-auto">
                    {o.currency} {o.amount}
                  </span>
                  <span className="font-mono text-[11px] text-[#4a5a64] hidden sm:block">
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-[#4a5a64]">
                  {lines.map((l) => `${l.name}×${l.qty}`).join(" · ")}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {o.checkoutUrl && o.status === "pending" && (
                    <a
                      href={o.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-md border border-emerald-500/40 font-mono text-xs text-emerald-300 hover:bg-emerald-500/10 transition-colors min-h-[40px] inline-flex items-center"
                    >
                      ↗ Open checkout
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => refresh.mutate({ customId: o.customId })}
                    disabled={refresh.isPending}
                    className="px-3 py-2 rounded-md border border-[#22303a] font-mono text-xs text-[#7d94a0] hover:text-emerald-300 hover:border-emerald-500/50 disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]"
                  >
                    Refresh status
                  </button>
                  {(o.status === "paid" || o.status === "captured") && (
                    <button
                      type="button"
                      onClick={() => refund.mutate({ customId: o.customId })}
                      disabled={refund.isPending}
                      className="px-3 py-2 rounded-md border border-red-500/40 font-mono text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]"
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
