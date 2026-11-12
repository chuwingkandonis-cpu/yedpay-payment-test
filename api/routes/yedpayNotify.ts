import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getDb } from "../queries/connection";
import { webhookNotifications, orders, paymentTokens } from "@db/schema";
import { eq } from "drizzle-orm";
import { verifySignature, getCredentials } from "../services/yedpay";
import { log } from "../lib/logger";

export const yedpayNotifyRoutes = new Hono();

/**
 * Yedpay async-notification receiver (notify_url).
 * Handles two payload families:
 *  1. Online-payment notifications — urlencoded, HMAC-signed (`sign` field).
 *     Yedpay expects `text/plain` "success" back or it retries.
 *  2. Tokenization card-registration notifications — unsigned JSON body
 *     shaped {id, status, store_id, custom_id, company_id}.
 */
yedpayNotifyRoutes.post(
  "/",
  bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.body(null, 413) }),
  async (c) => {
    const rawBody = await c.req.text();

    // ---- tokenization webhook: unsigned JSON with a token id --------------
    const trimmed = rawBody.trim();
    if (trimmed.startsWith("{")) {
      try {
        const body = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof body.id === "string" && typeof body.status === "string") {
          const tokenId = body.id;
          const tokenStatus = body.status;
          const customId =
            typeof body.custom_id === "string" ? body.custom_id : null;
          try {
            await getDb().insert(webhookNotifications).values({
              rawBody: rawBody.slice(0, 60000),
              parsedBody: JSON.stringify(body),
              signValid: null,
              requestType: "tokenization",
              customId,
              txnStatus: tokenStatus,
              sourceIp:
                c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            });
            await getDb()
              .update(paymentTokens)
              .set({ status: tokenStatus, lastResponse: rawBody.slice(0, 60000) })
              .where(eq(paymentTokens.tokenId, tokenId));
            if (tokenStatus === "active" && customId) {
              await getDb()
                .update(orders)
                .set({ status: "monthly_active" })
                .where(eq(orders.customId, customId));
            }
          } catch (err) {
            log.error("failed to store token notification", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
          log.info("yedpay token notification received", { tokenStatus });
          return c.text("success", 200, { "Content-Type": "text/plain" });
        }
      } catch {
        // not JSON after all — fall through to the signed-form handler
      }
    }

    // ---- online-payment webhook: urlencoded + signed ----------------------
    const { signKey } = getCredentials();
    const result = verifySignature(rawBody, signKey);

    const parsed = result.parsed as Record<string, unknown>;
    const txn = (parsed.transaction ?? parsed.authorization ?? {}) as Record<
      string,
      unknown
    >;

    const customId = typeof txn.custom_id === "string" ? txn.custom_id : null;
    const txnStatus = typeof txn.status === "string" ? txn.status : null;

    try {
      await getDb().insert(webhookNotifications).values({
        rawBody: rawBody.slice(0, 60000),
        parsedBody: JSON.stringify(parsed),
        signValid: result.valid,
        signValue: result.receivedSign || null,
        requestType:
          typeof parsed.request_type === "string" ? parsed.request_type : null,
        customId,
        txnStatus,
        sourceIp:
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      });
    } catch (err) {
      log.error("failed to store yedpay notification", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Sync demo-store order status — only for notifications with a valid
    // signature, so a forged POST can't flip an order to "paid".
    if (result.valid && customId && txnStatus) {
      try {
        await getDb()
          .update(orders)
          .set({ status: txnStatus, txnStatus, lastResponse: rawBody.slice(0, 60000) })
          .where(eq(orders.customId, customId));
      } catch (err) {
        log.error("failed to sync order from notification", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.info("yedpay notification received", {
      signValid: result.valid,
      requestType: parsed.request_type,
    });

    // Contract required by Yedpay: text/plain "success"
    return c.text("success", 200, { "Content-Type": "text/plain" });
  },
);

// GET just explains what the endpoint is for (handy when opened in a browser)
yedpayNotifyRoutes.get("/", (c) =>
  c.json({
    ok: true,
    message:
      "Yedpay async notification endpoint. Configure this URL as notify_url when creating an online payment.",
  }),
);
