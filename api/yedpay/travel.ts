import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { orders, paymentTokens } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import {
  computeTravelPremium,
  travelItemsSummary,
  TRAVEL_PLANS,
  TRAVEL_ADDONS,
} from "../../contracts/travel";
import { callYedpay, getCredentials } from "../services/yedpay";
import { callTokenApi, tokenData } from "../services/yedpayToken";

const MONTHLY_MONTHS = 12;
const TOKEN_COMPANY_ID = "QLX17ML9"; // staging merchant company for tokenization
const TOKEN_STORE_ID = "7L9D1DRM"; // staging store used for card registration

const quoteShape = z.object({
  planId: z.string().min(1),
  travellers: z.number().int().min(1).max(9),
  days: z.number().int().min(1).max(180),
  addonIds: z.array(z.string()).max(10),
  origin: z.string().url(),
  // Optional payment-link settings mirrored from the
  // "Create Payment Link" panel in the console.
  settings: z
    .object({
      currency: z.string().optional(),
      gatewayCode: z.string().optional(),
      allowedGateways: z.string().optional(),
      wallet: z.string().optional(),
      expiryTime: z.string().optional(),
      extraParameters: z.string().optional(),
      paymentData: z.string().optional(),
      checkoutDomainId: z.string().optional(),
      isAuthorization: z.boolean().optional(),
      lang: z.string().optional(),
      disableAlipayAppAutoOpen: z.boolean().optional(),
      merchantReference: z.string().optional(),
      merchantUserId: z.string().optional(),
    })
    .optional(),
});

function genPolicyId() {
  const rand = Math.random().toString(36).slice(2, 6);
  return `INS-${Date.now().toString(36)}-${rand}`;
}

function applySettings(
  params: Record<string, string>,
  s: NonNullable<z.infer<typeof quoteShape>["settings"]>,
) {
  if (s.gatewayCode?.trim()) params.gateway_code = s.gatewayCode.trim();
  if (s.allowedGateways?.trim()) params.allowed_gateways = s.allowedGateways.trim();
  if (s.wallet?.trim()) params.wallet = s.wallet.trim();
  if (s.expiryTime?.trim()) params.expiry_time = s.expiryTime.trim();
  if (s.extraParameters?.trim()) params.extra_parameters = s.extraParameters.trim();
  if (s.paymentData?.trim()) params.payment_data = s.paymentData.trim();
  if (s.checkoutDomainId?.trim()) params.checkout_domain_id = s.checkoutDomainId.trim();
  if (s.lang?.trim()) params.lang = s.lang.trim();
  if (s.isAuthorization) params.is_authorization = "1";
  if (s.disableAlipayAppAutoOpen) params.disable_alipay_app_auto_open = "1";
  if (s.merchantReference?.trim()) params.merchant_reference = s.merchantReference.trim();
  if (s.merchantUserId?.trim()) params.merchant_user_id = s.merchantUserId.trim();
}

export const travelRouter = createRouter({
  // Static catalogue + premium recompute so the UI can show a live quote.
  quote: publicQuery
    .input(
      z.object({
        planId: z.string().min(1),
        travellers: z.number().int().min(1).max(9),
        days: z.number().int().min(1).max(180),
        addonIds: z.array(z.string()).max(10),
      }),
    )
    .query(async ({ input }) => {
      const { amount, breakdown } = computeTravelPremium(input);
      return { amount, breakdown };
    }),

  create: publicQuery.input(quoteShape).mutation(async ({ input }) => {
    const { amount } = computeTravelPremium(input);
    const plan = TRAVEL_PLANS.find((p) => p.id === input.planId)!;
    const addons = TRAVEL_ADDONS.filter((a) => input.addonIds.includes(a.id));
    const customId = genPolicyId();
    const s = input.settings ?? {};
    const currency = s.currency?.trim() || "HKD";

    const params: Record<string, string> = {
      amount,
      currency,
      custom_id: customId,
      return_url: `${input.origin}/travel?payment=success&order=${customId}`,
      return_url_failed: `${input.origin}/travel?payment=failed&order=${customId}`,
      notify_url: `${input.origin}/api/yedpay/notify`,
      subject: `Travel Insurance ${plan.name} ×${input.travellers} (${input.days}d)${addons.length ? " +" + addons.length + " add-on" : ""}`,
    };
    applySettings(params, s);

    const creds = getCredentials();
    const result = await callYedpay({
      ...creds,
      method: "POST",
      path: "/online-payment",
      params,
    });

    if (!result.ok || !result.responseJson) {
      return {
        ok: false as const,
        error: `Yedpay error (HTTP ${result.httpStatus})`,
        responseText: result.responseText,
      };
    }
    const data = (result.responseJson as Record<string, unknown>).data as
      | Record<string, unknown>
      | undefined;
    if (!data?.checkout_url) {
      return {
        ok: false as const,
        error: "Yedpay did not return a checkout_url",
        responseText: result.responseText,
      };
    }

    await getDb().insert(orders).values({
      customId,
      items: travelItemsSummary(input),
      amount,
      currency,
      status: "pending",
      paymentToken: String(data.token ?? ""),
      checkoutUrl: String(data.checkout_url),
      lastResponse: result.responseText.slice(0, 60000),
    });

    return {
      ok: true as const,
      customId,
      amount,
      checkoutUrl: String(data.checkout_url),
    };
  }),

  list: publicQuery.query(async () => {
    const rows = await getDb().select().from(orders).orderBy(desc(orders.id)).limit(60);
    const policies = rows.filter((r) => String(r.customId).startsWith("INS-")).slice(0, 30);
    const tokens = await getDb().select().from(paymentTokens).orderBy(desc(paymentTokens.id)).limit(60);
    const byCustomId = new Map(tokens.map((t) => [t.customId, t]));
    return policies.map((p) => ({
      ...p,
      monthly: byCustomId.get(p.customId) ?? null,
    }));
  }),

  /* ---------------- monthly billing (tokenization) ---------------- */

  // Create a policy billed monthly: registers a card via Precreate Token and
  // returns the card-registration link for the customer.
  createMonthly: publicQuery.input(quoteShape).mutation(async ({ input }) => {
    const { amount } = computeTravelPremium(input);
    const customId = genPolicyId();
    const s = input.settings ?? {};
    const currency = s.currency?.trim() || "HKD";
    const monthlyAmount = (Number(amount) / MONTHLY_MONTHS).toFixed(2);

    const result = await callTokenApi({
      method: "POST",
      path: `/companies/${TOKEN_COMPANY_ID}/payment-token/precreate-token`,
      body: {
        custom_id: customId,
        store_id: TOKEN_STORE_ID,
        notify_url: `${input.origin}/api/yedpay/notify`,
        return_url: `${input.origin}/travel?token=registered&order=${customId}`,
        lang: "zh",
      },
    });

    const data = tokenData(result);
    if (!result.ok || !data) {
      const msg =
        result.responseJson &&
        typeof (result.responseJson as Record<string, unknown>).message === "string"
          ? String((result.responseJson as Record<string, unknown>).message)
          : "";
      return {
        ok: false as const,
        error: `Yedpay error (HTTP ${result.httpStatus})${msg ? ` — ${msg}` : ""}`,
        responseText: result.responseText,
      };
    }

    const links = (data._links ?? {}) as Record<string, unknown>;
    const registerUrl = typeof links.register === "string" ? links.register : "";
    const tokenId = String(data.id ?? "");
    if (!tokenId || !registerUrl) {
      return {
        ok: false as const,
        error: "Yedpay did not return a token id / register link",
        responseText: result.responseText,
      };
    }

    const items = JSON.parse(travelItemsSummary(input)) as unknown[];
    items.push({
      productId: "billing-monthly",
      name: `每月收款 Monthly ×${MONTHLY_MONTHS} (${currency} ${monthlyAmount}/月)`,
      qty: 1,
    });

    await getDb().insert(orders).values({
      customId,
      items: JSON.stringify(items),
      amount,
      currency,
      status: "awaiting_card",
      paymentToken: tokenId,
      checkoutUrl: registerUrl,
      lastResponse: result.responseText.slice(0, 60000),
    });
    await getDb().insert(paymentTokens).values({
      tokenId,
      customId,
      companyId: String(data.company_id ?? TOKEN_COMPANY_ID),
      storeId: typeof data.store_id === "string" ? data.store_id : TOKEN_STORE_ID,
      status: String(data.status ?? "pending"),
      registerUrl,
      months: MONTHLY_MONTHS,
      monthsPaid: 0,
      monthlyAmount,
      currency,
      lastResponse: result.responseText.slice(0, 60000),
    });

    return {
      ok: true as const,
      customId,
      amount,
      monthlyAmount,
      months: MONTHLY_MONTHS,
      tokenId,
      registerUrl,
    };
  }),

  // Re-fetch a registered card token and sync our local copy.
  tokenRefresh: publicQuery
    .input(z.object({ customId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [tok] = await getDb()
        .select()
        .from(paymentTokens)
        .where(eq(paymentTokens.customId, input.customId))
        .limit(1);
      if (!tok) return { ok: false as const, error: "No token for this policy" };

      const result = await callTokenApi({
        method: "GET",
        path: `/companies/${tok.companyId}/payment-token/${tok.tokenId}`,
      });
      const data = tokenData(result);
      let status: string | null = null;
      if (data) {
        status = typeof data.status === "string" ? data.status : null;
        await getDb()
          .update(paymentTokens)
          .set({
            status: status ?? tok.status,
            name: typeof data.name === "string" && data.name ? data.name : tok.name,
            cardType:
              typeof data.type === "string" && data.type ? data.type : tok.cardType,
            lastResponse: result.responseText.slice(0, 60000),
          })
          .where(eq(paymentTokens.customId, input.customId));
        if (status === "active" && tok.status !== "active") {
          // Card just became usable — mark the policy as in-force.
          await getDb()
            .update(orders)
            .set({ status: "monthly_active" })
            .where(eq(orders.customId, input.customId));
        }
      }
      return { ok: result.ok, httpStatus: result.httpStatus, status, responseJson: result.responseJson };
    }),

  // Charge one monthly instalment against the registered card.
  chargeMonthly: publicQuery
    .input(z.object({ customId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [tok] = await getDb()
        .select()
        .from(paymentTokens)
        .where(eq(paymentTokens.customId, input.customId))
        .limit(1);
      if (!tok) return { ok: false as const, error: "No token for this policy" };
      if (tok.status !== "active") {
        return { ok: false as const, error: `Card not active yet (status: ${tok.status}) — register the card first` };
      }
      if (tok.monthsPaid >= tok.months) {
        return { ok: false as const, error: "All instalments already collected" };
      }

      const instalmentNo = tok.monthsPaid + 1;
      const chargeId = `${input.customId}-M${String(instalmentNo).padStart(2, "0")}`.slice(0, 64);
      const result = await callTokenApi({
        method: "POST",
        path: `/payment-token/${tok.tokenId}/payment`,
        body: {
          amount: Number(tok.monthlyAmount),
          currency: tok.currency,
          custom_id: chargeId,
        },
      });
      const data = tokenData(result);
      if (!result.ok || !data) {
        const msg =
          result.responseJson &&
          typeof (result.responseJson as Record<string, unknown>).message === "string"
            ? String((result.responseJson as Record<string, unknown>).message)
            : "";
        return {
          ok: false as const,
          error: `Yedpay error (HTTP ${result.httpStatus})${msg ? ` — ${msg}` : ""}`,
          responseText: result.responseText,
        };
      }

      const paidStatus = typeof data.status === "string" ? data.status : "paid";
      const newMonthsPaid = paidStatus === "paid" ? instalmentNo : tok.monthsPaid;
      await getDb()
        .update(paymentTokens)
        .set({
          monthsPaid: newMonthsPaid,
          lastChargeId: chargeId,
          lastResponse: result.responseText.slice(0, 60000),
        })
        .where(eq(paymentTokens.customId, input.customId));
      if (newMonthsPaid >= tok.months) {
        await getDb()
          .update(orders)
          .set({ status: "paid" })
          .where(eq(orders.customId, input.customId));
      }

      return {
        ok: true as const,
        status: paidStatus,
        monthsPaid: newMonthsPaid,
        months: tok.months,
        chargeId,
        responseJson: result.responseJson,
      };
    }),

  // Remove a registered card (cancel monthly billing registration).
  deleteToken: publicQuery
    .input(z.object({ customId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [tok] = await getDb()
        .select()
        .from(paymentTokens)
        .where(eq(paymentTokens.customId, input.customId))
        .limit(1);
      if (!tok) return { ok: false as const, error: "No token for this policy" };

      const result = await callTokenApi({
        method: "DELETE",
        path: `/payment-token/${tok.tokenId}`,
      });
      if (result.ok) {
        await getDb().delete(paymentTokens).where(eq(paymentTokens.customId, input.customId));
        await getDb()
          .update(orders)
          .set({ status: "cancelled" })
          .where(eq(orders.customId, input.customId));
      }
      return { ok: result.ok, httpStatus: result.httpStatus, responseJson: result.responseJson, responseText: result.responseText };
    }),

  refresh: publicQuery
    .input(z.object({ customId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const creds = getCredentials();
      const result = await callYedpay({
        ...creds,
        method: "GET",
        path: "/online-payment/query",
        query: { custom_id: input.customId },
      });
      let status: string | null = null;
      if (result.responseJson) {
        const body = result.responseJson as Record<string, unknown>;
        const data = body.data as Record<string, unknown> | undefined;
        if (typeof data?.status === "string") status = data.status;
      }
      if (status) {
        await getDb()
          .update(orders)
          .set({ status, txnStatus: status, lastResponse: result.responseText.slice(0, 60000) })
          .where(eq(orders.customId, input.customId));
      }
      return { ok: result.ok, httpStatus: result.httpStatus, status, responseJson: result.responseJson };
    }),

  refund: publicQuery
    .input(z.object({ customId: z.string().min(1), amount: z.string().optional() }))
    .mutation(async ({ input }) => {
      const creds = getCredentials();
      const params: Record<string, string> = {
        custom_id: input.customId,
        refund_reason: "Policy cancelled (demo)",
      };
      if (input.amount) params.amount = input.amount;
      const result = await callYedpay({
        ...creds,
        method: "PUT",
        path: `/online-payment/${encodeURIComponent(input.customId)}/refund`,
        params,
      });
      let status: string | null = null;
      if (result.responseJson) {
        const body = result.responseJson as Record<string, unknown>;
        const data = body.data as Record<string, unknown> | undefined;
        if (typeof data?.status === "string") status = data.status;
      }
      if (status) {
        await getDb()
          .update(orders)
          .set({ status, txnStatus: status, lastResponse: result.responseText.slice(0, 60000) })
          .where(eq(orders.customId, input.customId));
      }
      return { ok: result.ok, httpStatus: result.httpStatus, status, responseJson: result.responseJson };
    }),
});
