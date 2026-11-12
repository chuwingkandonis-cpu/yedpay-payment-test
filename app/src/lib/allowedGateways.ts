/**
 * "Allowed gateways" config for Create Payment Link.
 *
 * When gateway_code is left empty ("All available gateways"), the checkout
 * page shows every gateway on the merchant account. Ticking gateways here
 * builds the `allowed_gateways` JSON parameter that restricts which payment
 * methods the checkout page offers, e.g.
 *
 * {
 *   "1": { "admin_fee": "0.022" },
 *   "6": { "admin_fee": "0.022", "mobile_show_qrcode": true },
 *   "7": { "admin_fee": "0.022", "specific_gateway": ["4_2"] }
 * }
 */

export const ALLOWED_GATEWAY_ADMIN_FEE = "0.022";

export interface AllowedGatewaySpec {
  id: string;
  label: string;
  /** Adds "mobile_show_qrcode": true to this gateway's entry. */
  mobileShowQrcode?: boolean;
  /** Adds "specific_gateway": [...] to this gateway's entry. */
  specificGateway?: string[];
}

export const ALLOWED_GATEWAYS: AllowedGatewaySpec[] = [
  { id: "1", label: "Gateway 1 · Credit Card 信用卡" },
  { id: "3", label: "Gateway 3 · UnionPay 銀聯" },
  { id: "6", label: "Gateway 6 · WeChat Pay 微信支付", mobileShowQrcode: true },
  { id: "7", label: "Gateway 7 · AlipayHK", specificGateway: ["4_2"] },
  { id: "8", label: "Gateway 8 · Alipay 支付寶", specificGateway: ["4_2"] },
  { id: "9", label: "Gateway 9 · FPS 轉數快" },
];

export const ALL_ALLOWED_GATEWAY_IDS = ALLOWED_GATEWAYS.map((g) => g.id);

export interface AllowedGatewayEntry {
  admin_fee: string;
  mobile_show_qrcode?: boolean;
  specific_gateway?: string[];
}

/** Build the gateway-id -> config object for the ticked gateway ids. */
export function buildAllowedGateways(
  ids: string[],
): Record<string, AllowedGatewayEntry> {
  const out: Record<string, AllowedGatewayEntry> = {};
  for (const g of ALLOWED_GATEWAYS) {
    if (!ids.includes(g.id)) continue;
    const entry: AllowedGatewayEntry = { admin_fee: ALLOWED_GATEWAY_ADMIN_FEE };
    if (g.mobileShowQrcode) entry.mobile_show_qrcode = true;
    if (g.specificGateway) entry.specific_gateway = g.specificGateway;
    out[g.id] = entry;
  }
  return out;
}

/**
 * Serialize the ticked allowed gateways for the `allowed_gateways` API
 * parameter. Returns "" when nothing is ticked.
 *
 * Verified against Yedpay staging: this is the parameter the checkout page
 * actually filters on — radios come back with data-allowed-gateway-id and
 * data-admin-fee taken from this JSON.
 */
export function buildAllowedGatewaysParam(ids: string[]): string {
  if (ids.length === 0) return "";
  return JSON.stringify(buildAllowedGateways(ids));
}
