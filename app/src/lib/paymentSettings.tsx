import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared "Create Payment Link" settings.
 * The EndpointRunner (Online Payment > Create Payment Link) writes its form
 * values here; the Demo Store reads them so its checkout uses exactly the
 * same payment configuration (currency, gateway, lang, pre-auth, etc.).
 *
 * Order-owned fields (amount, custom_id, return_url, notify_url) are NOT
 * shared — the store always controls those.
 */

export interface PaymentLinkSettings {
  currency: string;
  subject: string;
  gatewayCode: string;
  allowedGateways: string;
  wallet: string;
  expiryTime: string;
  extraParameters: string;
  paymentData: string;
  checkoutDomainId: string;
  isAuthorization: boolean;
  lang: string;
  disableAlipayAppAutoOpen: boolean;
  merchantReference: string;
  merchantUserId: string;
}

const DEFAULTS: PaymentLinkSettings = {
  currency: "HKD",
  subject: "",
  gatewayCode: "",
  allowedGateways: "",
  wallet: "",
  expiryTime: "",
  extraParameters: "",
  paymentData: "",
  checkoutDomainId: "",
  isAuthorization: false,
  lang: "",
  disableAlipayAppAutoOpen: false,
  merchantReference: "",
  merchantUserId: "",
};

// EndpointRunner field name -> settings key
const FIELD_MAP: Record<string, keyof PaymentLinkSettings> = {
  currency: "currency",
  subject: "subject",
  gatewayCode: "gatewayCode",
  allowedGateways: "allowedGateways",
  wallet: "wallet",
  expiryTime: "expiryTime",
  extraParameters: "extraParameters",
  paymentData: "paymentData",
  checkoutDomainId: "checkoutDomainId",
  isAuthorization: "isAuthorization",
  lang: "lang",
  disableAlipayAppAutoOpen: "disableAlipayAppAutoOpen",
  merchantReference: "merchantReference",
  merchantUserId: "merchantUserId",
};

interface Ctx {
  settings: PaymentLinkSettings;
  /** Merge EndpointRunner "createPaymentLink" form values into the store. */
  syncFromForm: (values: Record<string, string>) => void;
}

const PaymentSettingsContext = createContext<Ctx | null>(null);

export function PaymentSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PaymentLinkSettings>(DEFAULTS);

  const syncFromForm = useCallback((values: Record<string, string>) => {
    setSettings((prev) => {
      const next = { ...prev };
      for (const [field, key] of Object.entries(FIELD_MAP)) {
        const raw = values[field];
        if (raw === undefined) continue;
        if (key === "isAuthorization" || key === "disableAlipayAppAutoOpen") {
          next[key] = raw === "1";
        } else {
          next[key] = raw;
        }
      }
      return next;
    });
  }, []);

  return (
    <PaymentSettingsContext.Provider value={{ settings, syncFromForm }}>
      {children}
    </PaymentSettingsContext.Provider>
  );
}

export function usePaymentSettings(): Ctx {
  const ctx = useContext(PaymentSettingsContext);
  if (!ctx)
    throw new Error("usePaymentSettings must be used within PaymentSettingsProvider");
  return ctx;
}

/** Human-readable labels for the settings chips shown in the Demo Store. */
export function describeSettings(s: PaymentLinkSettings): string[] {
  const out: string[] = [];
  out.push(`currency ${s.currency || "HKD"}`);
  if (s.gatewayCode) out.push(`gateway ${s.gatewayCode}`);
  if (s.allowedGateways.trim()) out.push("allowed_gateways");
  if (s.wallet) out.push(`wallet ${s.wallet}`);
  if (s.lang) out.push(`lang ${s.lang}`);
  if (s.subject) out.push(`subject "${s.subject}"`);
  if (s.expiryTime) out.push(`expiry ${s.expiryTime}s`);
  if (s.isAuthorization) out.push("pre-auth");
  if (s.extraParameters.trim()) out.push("extra_parameters");
  if (s.paymentData.trim()) out.push("payment_data");
  if (s.checkoutDomainId.trim()) out.push("checkout_domain_id");
  if (s.disableAlipayAppAutoOpen) out.push("no-alipay-autopen");
  if (s.merchantReference.trim()) out.push(`merchant_ref "${s.merchantReference}"`);
  if (s.merchantUserId.trim()) out.push(`merchant_user ${s.merchantUserId}`);
  return out;
}
