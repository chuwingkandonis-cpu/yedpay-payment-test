import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { orders } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import { DEMO_PRODUCTS } from "../../contracts/products";
import { callYedpay, getCredentials } from "../services/yedpay";

const cartItem = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(99),
  price: z.number().min(0.1).max(999999),
});

function genCustomId() {
  const rand = Math.random().toString(36).slice(2, 6);
  return `ORD-${Date.now().toString(36)}-${rand}`;
}

export const ordersRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(orders).orderBy(desc(orders.id)).limit(30);
  }),

  create: publicQuery
    .input(
      z.object({
        items: z.array(cartItem).min(1),
        origin: z.string().url(),
        // Optional payment-link settings mirrored from the
        // "Create Payment Link" panel in the console.
        settings: z
          .object({
            currency: z.string().optional(),
            subject: z.string().optional(),
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
      }),
    )
    .mutation(async ({ input }) => {
      // Demo tool: prices come from the (editable) storefront inputs; the
      // product id is still validated against the catalogue and amounts are
      // recomputed server-side from price × qty.
      const lines = input.items.map((i) => {
        const p = DEMO_PRODUCTS.find((d) => d.id === i.productId);
        if (!p) throw new Error(`Unknown product: ${i.productId}`);
        return {
          productId: p.id,
          name: p.name,
          qty: i.qty,
          price: i.price,
        };
      });
      const amount = lines
        .reduce((sum, l) => sum + l.price * l.qty, 0)
        .toFixed(2);
      const customId = genCustomId();
      const s = input.settings ?? {};
      const currency = s.currency?.trim() || "HKD";

      const params: Record<string, string> = {
        amount,
        currency,
        custom_id: customId,
        return_url: `${input.origin}/?payment=success&order=${customId}`,
        return_url_failed: `${input.origin}/?payment=failed&order=${customId}`,
        notify_url: `${input.origin}/api/yedpay/notify`,
        subject: s.subject?.trim() || `Demo Store order ${customId}`,
      };
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
      const data = (result.responseJson as Record<string, unknown>)
        .data as Record<string, unknown>;
      if (!data?.checkout_url) {
        return {
          ok: false as const,
          error: "Yedpay did not return a checkout_url",
          responseText: result.responseText,
        };
      }

      await getDb().insert(orders).values({
        customId,
        items: JSON.stringify(lines),
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
          .set({
            status,
            txnStatus: status,
            lastResponse: result.responseText.slice(0, 60000),
          })
          .where(eq(orders.customId, input.customId));
      }
      return { ok: result.ok, httpStatus: result.httpStatus, status, responseJson: result.responseJson };
    }),

  refund: publicQuery
    .input(
      z.object({
        customId: z.string().min(1),
        amount: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = getCredentials();
      const params: Record<string, string> = {
        custom_id: input.customId,
        refund_reason: "Demo store refund",
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
