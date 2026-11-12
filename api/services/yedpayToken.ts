import { baseUrl, getCredentials, type YedpayCallResult } from "./yedpay";

/**
 * Yedpay Tokenization API client.
 *
 * Differences from the online-payment API (per the tokenization integration
 * guide, 2025-08-22):
 *  - bodies are JSON (docs show JSON request/response payloads)
 *  - auth header is documented as `Authentication: API-KEY {key}` — we send
 *    both `Authentication` and `Authorization` so either spelling is accepted
 *  - no request signing (no `sign` parameter)
 *
 * Endpoints (all under /v1):
 *  POST   /companies/{company_id}/payment-token/precreate-token
 *  POST   /payment-token/{token_id}/payment
 *  GET    /companies/{company_id}/payment-token/{token_id}
 *  GET    /companies/{company_id}/payment-tokens
 *  DELETE /payment-token/{token_id}
 *  PUT    /payment-token/refund
 */
export async function callTokenApi(opts: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}): Promise<YedpayCallResult> {
  const creds = getCredentials();
  const url = new URL(`${baseUrl(creds.environment)}${opts.path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const requestBody = opts.body ? JSON.stringify(opts.body) : "";

  const started = Date.now();
  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      Authorization: `API-KEY ${creds.apiKey}`,
      Authentication: `API-KEY ${creds.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body:
      opts.method === "GET" || opts.method === "DELETE" || !requestBody
        ? undefined
        : requestBody,
  });
  const responseText = await res.text();
  let responseJson: unknown = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    // non-JSON response (e.g. HTML error page) — keep raw text
  }
  return {
    ok: res.ok,
    httpStatus: res.status,
    url: url.toString(),
    method: opts.method,
    requestBody,
    responseText,
    responseJson,
    durationMs: Date.now() - started,
  };
}

/** Extract `data` from a tokenization-API response envelope. */
export function tokenData(
  result: YedpayCallResult,
): Record<string, unknown> | null {
  if (!result.responseJson) return null;
  const body = result.responseJson as Record<string, unknown>;
  if (body.success === false) return null;
  const data = body.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}
