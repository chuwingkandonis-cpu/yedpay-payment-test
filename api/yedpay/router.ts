import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { apiCallLogs, webhookNotifications } from "@db/schema";
import { desc } from "drizzle-orm";
import {
  callYedpay,
  getCredentials,
  verifySignature,
  type YedpayCallResult,
  type YedpayEnvironment,
} from "../services/yedpay";

const envEnum = z.enum(["production", "staging"]);

const credShape = {
  environment: envEnum.optional(),
  apiKey: z.string().optional(),
  signKey: z.string().optional(),
};

function resolveCreds(input: {
  environment?: YedpayEnvironment;
  apiKey?: string;
  signKey?: string;
}) {
  const base = getCredentials();
  return {
    environment: input.environment ?? base.environment,
    apiKey: input.apiKey?.trim() || base.apiKey,
    signKey: input.signKey?.trim() || base.signKey,
  };
}

async function logCall(
  endpointKey: string,
  label: string,
  result: YedpayCallResult,
  customId?: string,
) {
  try {
    await getDb().insert(apiCallLogs).values({
      endpointKey,
      label,
      method: result.method,
      url: result.url,
      environment: endpointKey === "custom" ? "custom" : "",
      requestBody: result.requestBody || null,
      httpStatus: result.httpStatus,
      ok: result.ok,
      responseBody: result.responseText?.slice(0, 60000) ?? null,
      durationMs: result.durationMs,
      customId: customId ?? null,
    });
  } catch {
    // logging must never break the actual API call
  }
}

export const yedpayRouter = createRouter({
  getConfig: publicQuery.query(() => {
    const c = getCredentials();
    return {
      apiKey: c.apiKey,
      signKey: c.signKey,
      environment: c.environment,
      hasKeys: Boolean(c.apiKey && c.signKey),
    };
  }),

  createPaymentLink: publicQuery
    .input(
      z.object({
        ...credShape,
        amount: z.string().min(1),
        currency: z.string().default("HKD"),
        customId: z.string().min(1).max(36),
        returnUrl: z.string().optional(),
        returnUrlFailed: z.string().optional(),
        notifyUrl: z.string().optional(),
        redirectUrlWap: z.string().optional(),
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
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const params: Record<string, string> = {
        amount: input.amount,
        currency: input.currency,
        custom_id: input.customId,
      };
      if (input.returnUrl) params.return_url = input.returnUrl;
      if (input.returnUrlFailed) params.return_url_failed = input.returnUrlFailed;
      if (input.notifyUrl) params.notify_url = input.notifyUrl;
      if (input.redirectUrlWap) params.redirect_url_wap = input.redirectUrlWap;
      if (input.subject) params.subject = input.subject;
      if (input.gatewayCode) params.gateway_code = input.gatewayCode;
      if (input.allowedGateways) params.allowed_gateways = input.allowedGateways;
      if (input.wallet) params.wallet = input.wallet;
      if (input.expiryTime) params.expiry_time = input.expiryTime;
      if (input.extraParameters) params.extra_parameters = input.extraParameters;
      if (input.paymentData) params.payment_data = input.paymentData;
      if (input.checkoutDomainId) params.checkout_domain_id = input.checkoutDomainId;
      if (input.isAuthorization) params.is_authorization = "1";
      if (input.lang) params.lang = input.lang;
      if (input.disableAlipayAppAutoOpen) params.disable_alipay_app_auto_open = "1";
      if (input.merchantReference) params.merchant_reference = input.merchantReference;
      if (input.merchantUserId) params.merchant_user_id = input.merchantUserId;

      const result = await callYedpay({
        ...creds,
        method: "POST",
        path: "/online-payment",
        params,
      });
      await logCall("createPaymentLink", "Create Payment Link", result, input.customId);
      return result;
    }),

  queryPayment: publicQuery
    .input(
      z.object({
        ...credShape,
        customId: z.string().optional(),
        paymentToken: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const query: Record<string, string> = {};
      if (input.customId) query.custom_id = input.customId;
      if (input.paymentToken) query.payment_token = input.paymentToken;
      const result = await callYedpay({
        ...creds,
        method: "GET",
        path: "/online-payment/query",
        query,
      });
      await logCall("queryPayment", "Query Payment", result, input.customId);
      return result;
    }),

  refundByCustomId: publicQuery
    .input(
      z.object({
        ...credShape,
        customId: z.string().min(1),
        refundReason: z.string().optional(),
        amount: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const params: Record<string, string> = { custom_id: input.customId };
      if (input.refundReason) params.refund_reason = input.refundReason;
      if (input.amount) params.amount = input.amount;
      const result = await callYedpay({
        ...creds,
        method: "PUT",
        path: `/online-payment/${encodeURIComponent(input.customId)}/refund`,
        params,
      });
      await logCall("refundByCustomId", "Refund (Custom ID)", result, input.customId);
      return result;
    }),

  refundByTransactionId: publicQuery
    .input(
      z.object({
        ...credShape,
        transactionId: z.string().min(1),
        refundReason: z.string().optional(),
        amount: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const params: Record<string, string> = {};
      if (input.refundReason) params.refund_reason = input.refundReason;
      if (input.amount) params.amount = input.amount;
      const result = await callYedpay({
        ...creds,
        method: "POST",
        path: `/transactions/${encodeURIComponent(input.transactionId)}/refund`,
        params,
      });
      await logCall("refundByTransactionId", "Refund (Transaction ID)", result);
      return result;
    }),

  listAuthorizations: publicQuery
    .input(
      z.object({
        ...credShape,
        companyId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const result = await callYedpay({
        ...creds,
        method: "GET",
        path: `/companies/${encodeURIComponent(input.companyId)}/authorizations`,
        query: { sort: "-created_at" },
      });
      await logCall("listAuthorizations", "List Pre-Authorizations", result);
      return result;
    }),

  getAuthorization: publicQuery
    .input(
      z.object({
        ...credShape,
        companyId: z.string().min(1),
        authorizationId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const result = await callYedpay({
        ...creds,
        method: "GET",
        path: `/companies/${encodeURIComponent(input.companyId)}/authorizations/${encodeURIComponent(input.authorizationId)}`,
        query: { include: "transactions" },
      });
      await logCall("getAuthorization", "Get Pre-Authorization", result);
      return result;
    }),

  captureAuthorization: publicQuery
    .input(
      z.object({
        ...credShape,
        authorizationId: z.string().min(1),
        amount: z.string().min(1),
        currency: z.string().default("HKD"),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const result = await callYedpay({
        ...creds,
        method: "PUT",
        path: `/authorization/${encodeURIComponent(input.authorizationId)}/capture`,
        params: { amount: input.amount, currency: input.currency },
      });
      await logCall("captureAuthorization", "Capture Pre-Authorization", result);
      return result;
    }),

  cancelAuthorization: publicQuery
    .input(
      z.object({
        ...credShape,
        authorizationId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const result = await callYedpay({
        ...creds,
        method: "PUT",
        path: `/authorization/${encodeURIComponent(input.authorizationId)}/cancel`,
      });
      await logCall("cancelAuthorization", "Cancel Pre-Authorization", result);
      return result;
    }),

  incrementalAuthorization: publicQuery
    .input(
      z.object({
        ...credShape,
        authorizationId: z.string().min(1),
        amount: z.string().min(1),
        currency: z.string().default("HKD"),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const result = await callYedpay({
        ...creds,
        method: "PUT",
        path: `/authorization/${encodeURIComponent(input.authorizationId)}/increment`,
        params: { amount: input.amount, currency: input.currency },
      });
      await logCall("incrementalAuthorization", "Incremental Pre-Authorization", result);
      return result;
    }),

  customRequest: publicQuery
    .input(
      z.object({
        ...credShape,
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        path: z.string().min(1),
        params: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ input }) => {
      const creds = resolveCreds(input);
      const isGet = input.method === "GET" || input.method === "DELETE";
      const result = await callYedpay({
        ...creds,
        method: input.method,
        path: input.path,
        params: isGet ? {} : input.params,
        query: isGet ? input.params : {},
      });
      await logCall("custom", "Custom Request", result);
      return result;
    }),

  verifyNotification: publicQuery
    .input(
      z.object({
        rawBody: z.string().min(1),
        signKey: z.string().optional(),
      }),
    )
    .mutation(({ input }) => {
      const signKey = input.signKey?.trim() || getCredentials().signKey;
      return verifySignature(input.rawBody, signKey);
    }),

  history: publicQuery.query(async () => {
    return getDb()
      .select()
      .from(apiCallLogs)
      .orderBy(desc(apiCallLogs.id))
      .limit(50);
  }),

  notifications: publicQuery.query(async () => {
    return getDb()
      .select()
      .from(webhookNotifications)
      .orderBy(desc(webhookNotifications.id))
      .limit(50);
  }),

  clearHistory: publicQuery.mutation(async () => {
    await getDb().delete(apiCallLogs);
    return { ok: true };
  }),

  clearNotifications: publicQuery.mutation(async () => {
    await getDb().delete(webhookNotifications);
    return { ok: true };
  }),
});
