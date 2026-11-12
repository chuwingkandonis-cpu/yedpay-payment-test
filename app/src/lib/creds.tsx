import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/providers/trpc";

export interface Creds {
  environment: "production" | "staging";
  apiKey: string;
  signKey: string;
  loaded: boolean;
  setEnvironment: (v: "production" | "staging") => void;
  setApiKey: (v: string) => void;
  setSignKey: (v: string) => void;
}

const CredsContext = createContext<Creds | null>(null);

export function CredsProvider({ children }: { children: ReactNode }) {
  const config = trpc.yedpay.getConfig.useQuery();
  const [environment, setEnvironment] = useState<"production" | "staging">(
    "production",
  );
  const [apiKey, setApiKey] = useState("");
  const [signKey, setSignKey] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (config.data && !loaded) {
      setEnvironment(config.data.environment);
      setApiKey(config.data.apiKey);
      setSignKey(config.data.signKey);
      setLoaded(true);
    }
  }, [config.data, loaded]);

  return (
    <CredsContext.Provider
      value={{
        environment,
        apiKey,
        signKey,
        loaded,
        setEnvironment,
        setApiKey,
        setSignKey,
      }}
    >
      {children}
    </CredsContext.Provider>
  );
}

export function useCreds(): Creds {
  const ctx = useContext(CredsContext);
  if (!ctx) throw new Error("useCreds must be used within CredsProvider");
  return ctx;
}

export function maskKey(key: string): string {
  if (!key) return "—";
  if (key.length <= 10) return key.slice(0, 2) + "••••••";
  return `${key.slice(0, 6)}${"•".repeat(10)}${key.slice(-4)}`;
}
