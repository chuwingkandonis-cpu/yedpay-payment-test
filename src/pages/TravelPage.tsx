import { useMemo, useState } from "react";
import {
  Plane,
  Mail,
  Phone,
  ShieldCheck,
  Luggage,
  CalendarX2,
  Clock3,
  Check,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TRAVEL_PLANS, TRAVEL_ADDONS } from "@contracts/travel";
import { useCreds } from "@/lib/creds";
import { usePaymentSettings } from "@/lib/paymentSettings";

/* ------------------------------------------------------------------ */
/* Pearo design tokens                                                 */
/* ------------------------------------------------------------------ */

const HEADING_FONT = "font-['Roboto',sans-serif]";
const BODY_FONT = "font-['Open_Sans',sans-serif]";

const CARD_SHADOW = "shadow-[0_0_20px_rgba(108,118,134,0.12)]";
const CARD_SHADOW_HOVER =
  "hover:shadow-[0_0_28px_rgba(108,118,134,0.22)]";

const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-[5px] bg-[#002e5b] px-[30px] py-[13px] ${HEADING_FONT} text-[15px] font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-[#3aade1] min-h-[48px] cursor-pointer`;
const btnAccent = `inline-flex items-center justify-center gap-2 rounded-[5px] bg-[#3aade1] px-[30px] py-[13px] ${HEADING_FONT} text-[15px] font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-[#002e5b] min-h-[48px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`;
const btnOutline = `inline-flex items-center justify-center gap-2 rounded-[5px] border border-[#002e5b] bg-transparent px-[26px] py-[12px] ${HEADING_FONT} text-[14px] font-bold uppercase tracking-wide text-[#002e5b] transition-colors duration-300 hover:bg-[#3aade1] hover:border-[#3aade1] hover:text-white min-h-[44px] cursor-pointer`;
const btnOutlineWhite = `inline-flex items-center justify-center gap-2 rounded-[5px] border border-white/70 bg-transparent px-[30px] py-[13px] ${HEADING_FONT} text-[15px] font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-[#3aade1] hover:border-[#3aade1] min-h-[48px] cursor-pointer`;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-300",
  awaiting_card: "bg-violet-50 text-violet-700 border-violet-300",
  monthly_active: "bg-emerald-50 text-emerald-700 border-emerald-300",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-300",
  captured: "bg-emerald-50 text-emerald-700 border-emerald-300",
  refunded: "bg-sky-50 text-sky-700 border-sky-300",
  failed: "bg-red-50 text-red-600 border-red-300",
  cancelled: "bg-slate-50 text-slate-500 border-slate-300",
  expired: "bg-slate-50 text-slate-500 border-slate-300",
};

function statusStyle(s: string) {
  return STATUS_STYLE[s] ?? "bg-slate-50 text-slate-500 border-slate-300";
}

const money = (c: string, n: string | number) =>
  `${c} ${typeof n === "number" ? n.toFixed(2) : n}`;

function StepDot({
  n,
  label,
  short,
  active,
  done,
}: {
  n: number;
  label: string;
  short: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className={`h-9 w-9 shrink-0 rounded-full ${HEADING_FONT} text-sm font-bold flex items-center justify-center transition-colors ${
          active
            ? `bg-[#002e5b] text-white`
            : done
              ? `bg-[#3aade1] text-white`
              : "bg-[#e6e6e6] text-[#999999]"
        }`}
      >
        {done && !active ? <Check className="h-4 w-4" /> : n}
      </span>
      <span
        className={`${HEADING_FONT} text-[13px] font-bold uppercase tracking-wide whitespace-nowrap ${
          active ? `text-[#002e5b]` : "text-[#999999]"
        }`}
      >
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    </div>
  );
}

function SectionTitle({
  sub,
  title,
  desc,
  align = "center",
}: {
  sub: string;
  title: string;
  desc?: string;
  align?: "center" | "left";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-[700px] mb-[45px] ${alignCls}`}>
      <span
        className={`block text-[#3aade1] text-[18px] mb-2 ${BODY_FONT}`}
      >
        {sub}
      </span>
      <h2
        className={`${HEADING_FONT} uppercase font-black text-[30px] sm:text-[42px] leading-[1.15] text-[#002e5b]`}
      >
        {title}
      </h2>
      {desc && (
        <p className="mt-3 text-[#666666] text-[15px] leading-[1.8]">{desc}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function TravelPage() {
  const creds = useCreds();
  const { settings } = usePaymentSettings();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [planId, setPlanId] = useState("standard");
  const [travellers, setTravellers] = useState(1);
  const [days, setDays] = useState(5);
  const [destination, setDestination] = useState("Japan");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [holder, setHolder] = useState({ name: "", email: "" });
  const [billing, setBilling] = useState<"oneoff" | "monthly">("oneoff");
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  const quoteInput = useMemo(
    () => ({ planId, travellers, days, addonIds }),
    [planId, travellers, days, addonIds],
  );
  const quote = trpc.travel.quote.useQuery(quoteInput);
  const policiesQuery = trpc.travel.list.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const create = trpc.travel.create.useMutation();
  const createMonthly = trpc.travel.createMonthly.useMutation();
  const chargeMonthly = trpc.travel.chargeMonthly.useMutation({
    onSettled: () => utils.travel.list.invalidate(),
  });
  const tokenRefresh = trpc.travel.tokenRefresh.useMutation({
    onSettled: () => utils.travel.list.invalidate(),
  });
  const deleteToken = trpc.travel.deleteToken.useMutation({
    onSettled: () => utils.travel.list.invalidate(),
  });
  const refresh = trpc.travel.refresh.useMutation({
    onSettled: () => utils.travel.list.invalidate(),
  });
  const refund = trpc.travel.refund.useMutation({
    onSettled: () => utils.travel.list.invalidate(),
  });

  // Returned from Yedpay checkout (?payment=success|failed&order=INS-…)
  // or from the card-registration page (?token=registered&order=INS-…)
  const returnedOrder = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("payment");
    const tokenOutcome = params.get("token");
    const order = params.get("order");
    if (outcome && order) return { outcome, order };
    if (tokenOutcome && order) return { outcome: `token:${tokenOutcome}`, order };
    return null;
  }, []);

  const plan = TRAVEL_PLANS.find((p) => p.id === planId)!;
  const currency = settings.currency || "HKD";
  const amount = quote.data?.amount ?? "…";
  const MONTHS = 12;
  const monthlyAmount =
    quote.data?.amount != null
      ? (Number(quote.data.amount) / MONTHS).toFixed(2)
      : "…";
  const actionPending = create.isPending || createMonthly.isPending;

  const toggleAddon = (id: string) =>
    setAddonIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const buy = async () => {
    setError(null);
    try {
      const res = await create.mutateAsync({
        ...quoteInput,
        origin: window.location.origin,
        settings,
      });
      if (!res.ok) {
        setError(
          `${res.error}${res.responseText ? ` — ${res.responseText.slice(0, 300)}` : ""}`,
        );
        return;
      }
      setLastCreated(res.customId);
      utils.travel.list.invalidate().catch(() => {});
      window.open(res.checkoutUrl, "_blank", "noopener");
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Monthly billing: register the customer's card via the Tokenization API
  // (precreate-token) and open the hosted card-registration page.
  const registerMonthly = async () => {
    setError(null);
    try {
      const res = await createMonthly.mutateAsync({
        ...quoteInput,
        origin: window.location.origin,
        settings,
      });
      if (!res.ok) {
        setError(
          `${res.error}${res.responseText ? ` — ${res.responseText.slice(0, 300)}` : ""}`,
        );
        return;
      }
      setLastCreated(res.customId);
      utils.travel.list.invalidate().catch(() => {});
      window.open(res.registerUrl, "_blank", "noopener");
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const inputCls = `w-full h-[50px] rounded-[3px] border border-[#eeeeee] bg-white px-[15px] ${HEADING_FONT} text-[14px] font-medium text-[#002e5b] placeholder:text-[#999999] focus:outline-none focus:border-[#3aade1] transition-colors`;
  const labelCls = `block ${HEADING_FONT} text-[13px] font-bold uppercase tracking-wide text-[#002e5b] mb-2`;

  return (
    <div className={`min-h-dvh bg-white text-[#002e5b] ${BODY_FONT}`}>
      {/* ============================== header ============================== */}
      <header className="relative">
        {/* navy backdrop behind top strip (Pearo header-area::before) */}
        <div className={`absolute inset-x-0 top-0 h-[82%] bg-[#002e5b]`} />

        <div className="relative mx-auto max-w-6xl px-4">
          {/* top strip */}
          <div className="flex items-center justify-between gap-4 py-3 text-white">
            <ul className="hidden md:flex items-center gap-5 text-[13px]">
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#3aade1]`} />
                <a href="/" className={`hover:text-[#3aade1] transition-colors`}>
                  ← API Console
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#3aade1]`} />
                <a href="#quote" className={`hover:text-[#3aade1] transition-colors`}>
                  Get Covered
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#3aade1]`} />
                <a href="#policies" className={`hover:text-[#3aade1] transition-colors`}>
                  Claims &amp; Policies
                </a>
              </li>
            </ul>
            <a href="/" className="md:hidden text-[13px] text-white/90">
              ← API Console
            </a>

            <ul className="flex items-center gap-5">
              <li className="relative hidden lg:flex items-center gap-3 pl-0">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#3aade1] text-white`}
                >
                  <Mail className="h-4 w-4" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[12px] text-white/80">
                    Drop us an email
                  </span>
                  <span className={`block ${HEADING_FONT} text-[15px] font-bold`}>
                    demo@breezy.travel
                  </span>
                </span>
              </li>
              <li className="relative hidden lg:flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#3aade1] text-white`}
                >
                  <Phone className="h-4 w-4" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[12px] text-white/80">Call us</span>
                  <span className={`block ${HEADING_FONT} text-[15px] font-bold`}>
                    +852 3000 0000
                  </span>
                </span>
              </li>
              <li>
                <a
                  href="#quote"
                  className={`inline-flex items-center rounded-[5px] bg-[#3aade1] px-5 py-2.5 ${HEADING_FONT} text-[14px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-[#002e5b]`}
                >
                  Get a Quote
                </a>
              </li>
            </ul>
          </div>

          {/* navbar */}
          <nav
            className={`flex items-center gap-4 bg-white px-5 sm:px-7 shadow-[-10px_10px_0_rgba(255,255,255,0.35)] ${CARD_SHADOW}`}
          >
            <a href="#top" className="flex items-center gap-3 py-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#002e5b] text-white`}
              >
                <Plane className="h-5 w-5" />
              </span>
              <span className="leading-tight">
                <span
                  className={`block ${HEADING_FONT} text-[19px] font-black uppercase tracking-wide text-[#002e5b]`}
                >
                  Breezy<span className={`text-[#3aade1]`}>Travel</span>
                </span>
                <span className="block text-[11px] text-[#999999]">
                  旅遊保險 · Travel Insurance
                </span>
              </span>
            </a>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-7">
              {[
                ["Home", "#top"],
                ["Quote", "#quote"],
                ["My Policies", "#policies"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className={`${HEADING_FONT} text-[14px] font-bold uppercase text-[#002e5b] hover:text-[#3aade1] transition-colors`}
                >
                  {label}
                </a>
              ))}
            </div>
            <span
              className={`ml-2 inline-flex items-center rounded-[5px] border border-[#3aade1]/40 bg-[#3aade1]/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[#002e5b]`}
              title="Yedpay environment"
            >
              {creds.environment}
            </span>
          </nav>
        </div>
      </header>

      {/* ============================== hero ============================== */}
      <section id="top" className={`relative overflow-hidden bg-[#002e5b]`}>
        {/* decorative circles */}
        <div
          className={`pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full border-[60px] border-[#3aade1]/10`}
        />
        <div
          className={`pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[#3aade1]/5`}
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-28 sm:pt-20 sm:pb-36 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span
              className={`${HEADING_FONT} text-[#3aade1] text-[15px] font-bold uppercase tracking-[0.2em]`}
            >
              Keep Always Protected
            </span>
            <h1
              className={`mt-4 ${HEADING_FONT} font-black uppercase leading-[1.12] text-white text-[34px] sm:text-[52px]`}
            >
              話走就走嘅旅程，
              <br />
              由一份<span className={`text-[#3aade1]`}>保障</span>開始
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-[1.9] text-white/75">
              即時報價、三分鐘投保 — 醫療、行李、取消旅程全面保障。Checkout
              直接行 Yedpay 真實收款流程（staging），保單即時簽發。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#quote" className={btnAccent}>
                即時報價 Get a Quote
              </a>
              <a href="#policies" className={btnOutlineWhite}>
                我的保單
              </a>
            </div>
          </div>

          {/* certificate card visual */}
          <div className="relative hidden lg:block">
            <div
              className={`absolute -top-8 -right-6 h-40 w-40 rounded-full border-[24px] border-[#3aade1]/20`}
            />
            <div className={`relative mx-auto max-w-md rounded-[5px] bg-white p-7 ${CARD_SHADOW}`}>
              <div className={`flex items-center justify-between border-b border-[#eeeeee] pb-4`}>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#3aade1]/10 text-[#3aade1]`}
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <span
                    className={`${HEADING_FONT} text-[13px] font-bold uppercase tracking-wide text-[#002e5b]`}
                  >
                    Travel Insurance Certificate
                  </span>
                </div>
                <Plane className={`h-5 w-5 text-[#3aade1]`} />
              </div>
              <dl className="mt-4 space-y-3 text-[13px]">
                {[
                  ["Destination", "Japan 日本"],
                  ["Trip length", "5 days"],
                  ["Travellers", "1"],
                  ["Plan", "Standard 標準計劃"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-end justify-between gap-3">
                    <dt className="text-[#999999]">{k}</dt>
                    <dd
                      className={`flex-1 border-b border-dashed border-[#e0e0e0] pb-0.5 text-right ${HEADING_FONT} font-bold text-[#002e5b]`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-[12px] text-[#999999]">
                  Premium from
                </span>
                <span className={`${HEADING_FONT} text-[26px] font-black text-[#3aade1]`}>
                  HKD 68.00
                </span>
              </div>
            </div>
            <div
              className={`absolute -bottom-8 -left-4 flex items-center gap-3 rounded-[5px] bg-[#3aade1] px-5 py-4 text-white shadow-lg`}
            >
              <Clock3 className="h-7 w-7" />
              <div className="leading-tight">
                <div className={`${HEADING_FONT} text-[16px] font-black uppercase`}>
                  24/7 Support
                </div>
                <div className="text-[12px] text-white/85">
                  全球緊急支援熱線
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== feature cards ============================== */}
      <section className="relative z-10 -mt-16 sm:-mt-20">
        <div className="mx-auto max-w-6xl px-4 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "醫療及住院保障",
              en: "Medical Cover",
              desc: "海外醫療費用、住院現金及緊急醫療運送，全面照顧旅程需要。",
            },
            {
              icon: Luggage,
              title: "行李及個人物品",
              en: "Baggage Cover",
              desc: "行李遺失、損毁或延誤均可索償，旅遊證件補領費用亦受保。",
            },
            {
              icon: CalendarX2,
              title: "取消旅程保障",
              en: "Trip Cancellation",
              desc: "因突發事故取消或縮短旅程，已繳付而未獲退款之費用可獲賠償。",
            },
          ].map(({ icon: Icon, title, en, desc }) => (
            <div
              key={en}
              className={`group rounded-[5px] bg-white p-7 ${CARD_SHADOW} ${CARD_SHADOW_HOVER} transition-shadow`}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#3aade1]/10 text-[#3aade1] transition-colors group-hover:bg-[#3aade1] group-hover:text-white`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3
                className={`mt-5 ${HEADING_FONT} text-[17px] font-bold uppercase text-[#002e5b]`}
              >
                {title}
                <span className={`block text-[12px] font-bold text-[#3aade1] tracking-[0.15em]`}>
                  {en}
                </span>
              </h3>
              <p className="mt-3 text-[14px] leading-[1.8] text-[#666666]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== quote / purchase flow ============================== */}
      <section id="quote" className="mt-[70px] bg-[#f8f8f8] py-[70px] scroll-mt-6">
        <div className="mx-auto max-w-5xl px-4">
          <SectionTitle
            sub="Get Covered in 3 Easy Steps"
            title="即時報價 · 立即投保"
            desc="揀目的地、揀計劃、填投保人資料，然後直接用 Yedpay 付款 — 全程唔使三分鐘。"
          />

          {/* returned-from-checkout banner */}
          {returnedOrder && (
            <div
              className={`mb-6 rounded-[5px] border px-4 py-3 text-sm font-mono ${
                returnedOrder.outcome === "success" || returnedOrder.outcome === "token:registered"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {returnedOrder.outcome === "success"
                ? `✓ 已完成付款程序（保單 ${returnedOrder.order}）。狀態會自動更新，亦可撳 Refresh 查詢。`
                : returnedOrder.outcome === "token:registered"
                  ? `✓ 信用卡登記程序完成（保單 ${returnedOrder.order}）。Token 狀態會自動更新，亦可撳 Update token status 查詢。`
                  : `✕ 保單 ${returnedOrder.order} 付款未完成（失敗／取消／過期）。`}
            </div>
          )}

          <div className={`rounded-[5px] bg-white ${CARD_SHADOW} overflow-hidden`}>
            {/* stepper */}
            <div className="flex items-center gap-3 sm:gap-4 px-5 sm:px-8 py-5 border-b border-[#f0f0f0]">
              <StepDot n={1} label="行程資料" short="行程" active={step === 1} done={step > 1} />
              <span className="h-px flex-1 max-w-10 bg-[#e6e6e6]" />
              <StepDot n={2} label="計劃及附加保障" short="計劃" active={step === 2} done={step > 2} />
              <span className="h-px flex-1 max-w-10 bg-[#e6e6e6]" />
              <StepDot n={3} label="投保人及付款" short="付款" active={step === 3} done={false} />
            </div>

            <div className="p-5 sm:p-9">
              {step === 1 && (
                <div className="space-y-7">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <label className="block">
                      <span className={labelCls}>目的地 Destination</span>
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className={inputCls + " cursor-pointer"}
                      >
                        {["Japan 日本", "Korea 韓國", "Taiwan 台灣", "Thailand 泰國", "Europe 歐洲", "USA 美國", "Australia 澳洲", "Worldwide 全球"].map((d) => (
                          <option key={d} value={d.split(" ")[0]}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelCls}>旅程日數 Trip length (days)</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={days}
                        onChange={(e) =>
                          setDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>旅客人數 Travellers</span>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={travellers}
                        onChange={(e) =>
                          setTravellers(Math.max(1, Math.min(9, Number(e.target.value) || 1)))
                        }
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setStep(2)} className={btnPrimary}>
                      下一步 · 選擇計劃
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div className="grid sm:grid-cols-3 gap-5">
                    {TRAVEL_PLANS.map((p) => {
                      const active = p.id === planId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlanId(p.id)}
                          className={`relative text-left rounded-[5px] border p-6 transition-all cursor-pointer ${
                            active
                              ? `border-[#3aade1] bg-[#3aade1]/[0.06] ${CARD_SHADOW}`
                              : `border-[#eeeeee] bg-white hover:border-[#3aade1]/60 ${CARD_SHADOW_HOVER}`
                          }`}
                        >
                          {active && (
                            <span
                              className={`absolute top-3 right-3 h-6 w-6 rounded-full bg-[#3aade1] text-white flex items-center justify-center`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-full ${
                              active
                                ? `bg-[#3aade1] text-white`
                                : `bg-[#3aade1]/10 text-[#3aade1]`
                            } ${HEADING_FONT} text-xl font-black`}
                          >
                            {p.glyph}
                          </span>
                          <div
                            className={`mt-4 ${HEADING_FONT} text-[16px] font-bold uppercase text-[#002e5b]`}
                          >
                            {p.name}
                          </div>
                          <div className="text-[12px] text-[#999999]">{p.nameZh}</div>
                          <p className="mt-2.5 text-[13px] text-[#666666] leading-[1.7] min-h-[3.4em]">
                            {p.blurbZh}
                          </p>
                          <div className={`mt-4 ${HEADING_FONT} text-[15px] font-bold text-[#002e5b]`}>
                            <span className={`text-[11px] font-medium text-[#3aade1] uppercase`}>
                              from{" "}
                            </span>
                            {money(currency, p.baseRate)}
                            <span className="text-[11px] font-medium text-[#999999]">
                              {" "}
                              /traveller
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <div
                      className={`${HEADING_FONT} text-[14px] font-bold uppercase text-[#002e5b] mb-3`}
                    >
                      附加保障{" "}
                      <span className={`text-[#3aade1]`}>Optional benefits</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {TRAVEL_ADDONS.map((a) => {
                        const checked = addonIds.includes(a.id);
                        return (
                          <label
                            key={a.id}
                            className={`flex items-center gap-3 rounded-[5px] border px-4 py-4 cursor-pointer transition-all ${
                              checked
                                ? `border-[#3aade1] bg-[#3aade1]/[0.06]`
                                : `border-[#eeeeee] bg-white hover:border-[#3aade1]/60`
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAddon(a.id)}
                              className={`h-4 w-4 accent-[#3aade1] cursor-pointer`}
                            />
                            <span
                              className={`${HEADING_FONT} text-lg font-black ${
                                checked ? `text-[#3aade1]` : "text-[#cccccc]"
                              }`}
                            >
                              {a.glyph}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block ${HEADING_FONT} text-[13px] font-bold text-[#002e5b]`}
                              >
                                {a.name}
                              </span>
                              <span className="block text-[11px] text-[#999999]">
                                {a.nameZh} · +{money(currency, a.price)}/traveller
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button type="button" onClick={() => setStep(1)} className={btnOutline}>
                      <ArrowLeft className="h-4 w-4" />
                      返回 Back
                    </button>
                    <button type="button" onClick={() => setStep(3)} className={btnPrimary}>
                      下一步 · 投保人資料
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-7">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <label className="block">
                      <span className={labelCls}>投保人姓名 Policyholder name</span>
                      <input
                        value={holder.name}
                        onChange={(e) => setHolder((h) => ({ ...h, name: e.target.value }))}
                        placeholder="Chan Tai Man"
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className={labelCls}>電郵 Email（保單送遞）</span>
                      <input
                        type="email"
                        value={holder.email}
                        onChange={(e) => setHolder((h) => ({ ...h, email: e.target.value }))}
                        placeholder="taiman@example.com"
                        className={inputCls}
                      />
                    </label>
                  </div>

                  {/* billing mode — one-off vs monthly (tokenization) */}
                  <div>
                    <div className={`${HEADING_FONT} text-[14px] font-bold uppercase text-[#002e5b] mb-3`}>
                      收款方式{" "}
                      <span className={`text-[#3aade1]`}>Billing method</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(
                        [
                          {
                            id: "oneoff" as const,
                            icon: Wallet,
                            title: "一次性付款",
                            en: "One-off payment",
                            desc: "經 Yedpay checkout 即時收取全數保費，支援信用卡／轉數快／電子錢包。",
                          },
                          {
                            id: "monthly" as const,
                            icon: CalendarClock,
                            title: `每月收款 ×${MONTHS}`,
                            en: "Monthly billing",
                            desc: "先登記信用卡（Tokenization API），之後按月從已登記信用卡自動收款。",
                          },
                        ] as const
                      ).map(({ id, icon: Icon, title, en, desc }) => {
                        const active = billing === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setBilling(id)}
                            className={`relative text-left rounded-[5px] border p-5 transition-all cursor-pointer ${
                              active
                                ? `border-[#3aade1] bg-[#3aade1]/[0.06] ${CARD_SHADOW}`
                                : `border-[#eeeeee] bg-white hover:border-[#3aade1]/60 ${CARD_SHADOW_HOVER}`
                            }`}
                          >
                            {active && (
                              <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-[#3aade1] text-white flex items-center justify-center">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span
                              className={`flex h-11 w-11 items-center justify-center rounded-full ${
                                active ? "bg-[#3aade1] text-white" : "bg-[#3aade1]/10 text-[#3aade1]"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className={`mt-3 ${HEADING_FONT} text-[15px] font-bold uppercase text-[#002e5b]`}>
                              {title}
                              <span className="block text-[11px] font-bold text-[#3aade1] tracking-[0.12em]">
                                {en}
                              </span>
                            </div>
                            <p className="mt-2 text-[12px] text-[#666666] leading-[1.7]">{desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* premium summary — blockquote-style accent bar */}
                  <div className="relative rounded-[5px] bg-[#fafafa] p-6 sm:p-7">
                    <span
                      className={`absolute left-0 top-5 bottom-5 w-[3px] bg-[#3aade1]`}
                    />
                    <div className={`${HEADING_FONT} text-[14px] font-bold uppercase text-[#002e5b]`}>
                      {plan.name} {plan.nameZh} · {destination} · {days} 日 · {travellers} 人
                      {billing === "monthly" && (
                        <span className={`ml-2 text-[#3aade1]`}>· 每月收款</span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {quote.data?.breakdown.map((b) => (
                        <div key={b} className="font-mono text-[11px] text-[#999999]">
                          {b}
                        </div>
                      ))}
                      {billing === "monthly" && (
                        <div className="font-mono text-[11px] text-[#3aade1]">
                          ÷ {MONTHS} months = {currency} {monthlyAmount}/month
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eeeeee] pt-4 flex-wrap">
                      <span
                        className={`${HEADING_FONT} text-[14px] font-bold uppercase text-[#002e5b]`}
                      >
                        {billing === "monthly" ? "每月保費 Monthly premium" : "總保費 Total premium"}
                      </span>
                      <span className={`${HEADING_FONT} text-[26px] font-black text-[#3aade1]`}>
                        {billing === "monthly"
                          ? `${money(currency, monthlyAmount)}/月`
                          : money(currency, amount)}
                      </span>
                    </div>
                    {billing === "monthly" && (
                      <div className="mt-1 text-right text-[11px] text-[#999999]">
                        總保費 {money(currency, amount)} · 分 {MONTHS} 期
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs font-mono text-red-600 break-all">✕ {error}</p>
                  )}

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button type="button" onClick={() => setStep(2)} className={btnOutline}>
                      <ArrowLeft className="h-4 w-4" />
                      返回 Back
                    </button>
                    <button
                      type="button"
                      onClick={billing === "monthly" ? registerMonthly : buy}
                      disabled={actionPending || !creds.loaded}
                      className={btnAccent + " px-9"}
                    >
                      {actionPending ? (
                        <>
                          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          {billing === "monthly" ? "正在建立登記連結…" : "正在建立付款…"}
                        </>
                      ) : billing === "monthly" ? (
                        <>
                          <CreditCard className="h-4 w-4" />
                          登記信用卡 · 每月 {money(currency, monthlyAmount)}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          立即付款 {money(currency, amount)}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#999999] font-mono">
                    {billing === "monthly"
                      ? "撳掣後會經 Tokenization API（precreate-token）產生信用卡登記連結並喺新分頁開啟；登記成功後 Yedpay 會經 notify_url 通知，之後每月用已登記嘅卡收款。登記過程嘅 0.5 HKD 授權費會自動退回。"
                      : "撳掣後會簽發保單（custom_id = 保單編號）並喺新分頁開啟 Yedpay checkout。投保人資料只留喺呢個 demo 表格，唔會傳去 Yedpay。"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== policies ============================== */}
      <section id="policies" className="py-[70px] scroll-mt-6">
        <div className="mx-auto max-w-5xl px-4">
          <SectionTitle
            align="left"
            sub="Claims &amp; Policies"
            title="我的保單"
            desc={`共 ${policiesQuery.data?.length ?? 0} 份保單 · 每 5 秒自動更新狀態`}
          />

          {policiesQuery.data?.length === 0 && (
            <div className="rounded-[5px] border border-dashed border-[#dddddd] bg-[#fafafa] py-14 text-center text-[14px] text-[#999999]">
              暫時未有保單 — 喺上面即時報價買一份啦。
            </div>
          )}

          <div className="space-y-4">
            {policiesQuery.data?.map((o) => {
              let lines: { name: string; qty: number }[] = [];
              try {
                lines = JSON.parse(o.items);
              } catch {
                lines = [];
              }
              const isNew = lastCreated === o.customId;
              const monthly = o.monthly;
              return (
                <div
                  key={o.id}
                  className={`rounded-[5px] border bg-white p-5 transition-shadow ${
                    isNew
                      ? `border-[#3aade1] ${CARD_SHADOW}`
                      : "border-[#eeeeee] hover:shadow-[0_0_20px_rgba(108,118,134,0.15)]"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-mono text-xs font-semibold text-[#3aade1]`}>
                      {o.customId}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-[3px] border ${statusStyle(o.status)}`}
                    >
                      {o.status === "awaiting_card"
                        ? "AWAITING CARD"
                        : o.status === "monthly_active"
                          ? "MONTHLY ACTIVE"
                          : o.status.toUpperCase()}
                    </span>
                    {monthly && (
                      <span className="inline-flex items-center gap-1 rounded-[3px] border border-[#3aade1]/40 bg-[#3aade1]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#002e5b]">
                        <CalendarClock className="h-3 w-3" />
                        每月收款
                      </span>
                    )}
                    <span
                      className={`${HEADING_FONT} text-[15px] font-bold text-[#002e5b] ml-auto`}
                    >
                      {o.currency} {o.amount}
                    </span>
                    <span className="text-[11px] text-[#999999] hidden sm:block">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-[#999999]">
                    {lines.map((l) => `${l.name}×${l.qty}`).join(" · ")}
                  </div>

                  {/* monthly-billing panel */}
                  {monthly && (
                    <div className="mt-3 rounded-[5px] border border-[#eeeeee] bg-[#fafafa] px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap text-[12px]">
                        <CreditCard className="h-4 w-4 text-[#3aade1]" />
                        <span className={`${HEADING_FONT} font-bold text-[#002e5b]`}>
                          {monthly.name ||
                            (monthly.status === "active" ? "已登記信用卡" : "Card 未登記")}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-[3px] border ${
                            monthly.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-violet-50 text-violet-700 border-violet-300"
                          }`}
                        >
                          TOKEN {monthly.status.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-[#999999]">
                          {monthly.tokenId}
                        </span>
                        <span className="ml-auto font-mono text-[11px] text-[#002e5b]">
                          {monthly.monthsPaid}/{monthly.months} 期 · {monthly.currency}{" "}
                          {monthly.monthlyAmount}/月
                        </span>
                      </div>
                      {/* instalment progress */}
                      <div className="mt-2.5 flex gap-1">
                        {Array.from({ length: monthly.months }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${
                              i < monthly.monthsPaid ? "bg-[#3aade1]" : "bg-[#e0e0e0]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2.5 flex-wrap">
                    {/* one-off pending → checkout */}
                    {!monthly && o.checkoutUrl && o.status === "pending" && (
                      <a
                        href={o.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-[5px] bg-[#3aade1] px-4 py-2 ${HEADING_FONT} text-[12px] font-bold uppercase text-white hover:bg-[#002e5b] transition-colors min-h-[40px]`}
                      >
                        ↗ 前往付款
                      </a>
                    )}
                    {/* monthly: card registration link while token pending */}
                    {monthly && monthly.status !== "active" && monthly.registerUrl && (
                      <a
                        href={monthly.registerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-[5px] bg-[#3aade1] px-4 py-2 ${HEADING_FONT} text-[12px] font-bold uppercase text-white hover:bg-[#002e5b] transition-colors min-h-[40px]`}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        ↗ 登記信用卡
                      </a>
                    )}
                    {/* monthly: token status sync */}
                    {monthly && (
                      <button
                        type="button"
                        onClick={() => tokenRefresh.mutate({ customId: o.customId })}
                        disabled={tokenRefresh.isPending}
                        className={`inline-flex items-center gap-1.5 rounded-[5px] border border-[#002e5b] px-4 py-2 ${HEADING_FONT} text-[12px] font-bold uppercase text-[#002e5b] hover:bg-[#3aade1] hover:border-[#3aade1] hover:text-white disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]`}
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Token status
                      </button>
                    )}
                    {/* monthly: charge this month's instalment */}
                    {monthly && monthly.status === "active" && monthly.monthsPaid < monthly.months && (
                      <button
                        type="button"
                        onClick={() => chargeMonthly.mutate({ customId: o.customId })}
                        disabled={chargeMonthly.isPending}
                        className={`inline-flex items-center gap-1.5 rounded-[5px] bg-[#002e5b] px-4 py-2 ${HEADING_FONT} text-[12px] font-bold uppercase text-white hover:bg-[#3aade1] disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]`}
                      >
                        {chargeMonthly.isPending ? (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : (
                          <Wallet className="h-3.5 w-3.5" />
                        )}
                        收取第 {monthly.monthsPaid + 1} 期（{monthly.currency} {monthly.monthlyAmount}）
                      </button>
                    )}
                    {/* monthly: cancel card registration */}
                    {monthly && (
                      <button
                        type="button"
                        onClick={() => deleteToken.mutate({ customId: o.customId })}
                        disabled={deleteToken.isPending}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-red-300 px-4 py-2 font-['Roboto',sans-serif] text-[12px] font-bold uppercase text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]"
                      >
                        取消登記
                      </button>
                    )}
                    {/* one-off: query + refund */}
                    {!monthly && (
                      <button
                        type="button"
                        onClick={() => refresh.mutate({ customId: o.customId })}
                        disabled={refresh.isPending}
                        className={`inline-flex items-center gap-1.5 rounded-[5px] border border-[#002e5b] px-4 py-2 ${HEADING_FONT} text-[12px] font-bold uppercase text-[#002e5b] hover:bg-[#3aade1] hover:border-[#3aade1] hover:text-white disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]`}
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Refresh status
                      </button>
                    )}
                    {!monthly && (o.status === "paid" || o.status === "captured") && (
                      <button
                        type="button"
                        onClick={() => refund.mutate({ customId: o.customId })}
                        disabled={refund.isPending}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-red-300 px-4 py-2 font-['Roboto',sans-serif] text-[12px] font-bold uppercase text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer min-h-[40px]"
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
      </section>

      {/* ============================== CTA band ============================== */}
      <section className={`bg-[#3aade1]`}>
        <div className="mx-auto max-w-6xl px-4 py-12 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h2
              className={`${HEADING_FONT} text-white font-black uppercase text-[26px] sm:text-[36px] leading-tight`}
            >
              準備好出發未？
            </h2>
            <p className="mt-2 text-white/90 text-[15px]">
              即刻報價，三分鐘完成投保 — Yedpay staging 真實收款示範。
            </p>
          </div>
          <a
            href="#quote"
            className={`inline-flex items-center justify-center gap-2 rounded-[5px] bg-[#002e5b] px-8 py-3.5 ${HEADING_FONT} text-[15px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-[#002e5b] min-h-[48px]`}
          >
            <BadgeCheck className="h-4 w-4" />
            立即投保 Get Covered
          </a>
        </div>
      </section>

      {/* ============================== footer ============================== */}
      <footer className={`bg-[#002e5b] pt-[70px] text-[#ebe7e7]`}>
        <div className="mx-auto max-w-6xl px-4 grid gap-10 md:grid-cols-3 pb-10">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#3aade1] text-white`}
              >
                <Plane className="h-5 w-5" />
              </span>
              <span
                className={`${HEADING_FONT} text-[19px] font-black uppercase tracking-wide text-white`}
              >
                Breezy<span className={`text-[#3aade1]`}>Travel</span>
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-[1.8] text-[#ebe7e7]/80">
              BreezyTravel 係 Yedpay API Console 嘅 demo storefront —
              所有付款都係 staging 環境嘅真實 API 呼叫。
            </p>
            <span
              className={`mt-4 inline-flex items-center rounded-[5px] bg-[#3aade1] px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[#002e5b]`}
            >
              {creds.environment} environment
            </span>
          </div>

          <div>
            <h3
              className={`relative ${HEADING_FONT} text-[18px] font-black uppercase text-white pb-2.5 mb-6 border-b border-[#0c4776]`}
            >
              Quick Links
              <span className={`absolute left-0 -bottom-px h-px w-[55px] bg-[#3aade1]`} />
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] uppercase">
              {[
                ["API Console", "/"],
                ["Get a Quote", "#quote"],
                ["My Policies", "#policies"],
                ["Yedpay API Docs", "https://api.yedpay.com/"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className={`hover:text-[#3aade1] transition-colors`}
                    {...(href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3
              className={`relative ${HEADING_FONT} text-[18px] font-black uppercase text-white pb-2.5 mb-6 border-b border-[#0c4776]`}
            >
              Contact Info
              <span className={`absolute left-0 -bottom-px h-px w-[55px] bg-[#3aade1]`} />
            </h3>
            <ul className="space-y-3 text-[14px]">
              <li>
                <span className="font-semibold text-white">Endpoint: </span>
                <span className="font-mono text-[12px]">api-staging.yedpay.com</span>
              </li>
              <li>
                <span className="font-semibold text-white">Hotline: </span>
                +852 3000 0000（demo）
              </li>
              <li>
                <span className="font-semibold text-white">Email: </span>
                demo@breezy.travel
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#0c4776]">
          <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#ebe7e7]/80">
            <p>
              © 2026 BreezyTravel — demo storefront of the{" "}
              <a href="/" className="font-semibold text-white hover:text-[#3aade1]">
                Yedpay API Console
              </a>
            </p>
            <p className="font-mono text-[11px]">Powered by Yedpay · staging</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
