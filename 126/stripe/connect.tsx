import React, { useMemo } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { paymentClient } from "@/stripe/client";

const connectInstanceByAccount = new Map<string, ReturnType<typeof loadConnectAndInitialize>>();
const clientSecretRequestByAccount = new Map<string, Promise<string>>();

export function StripeConnectProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

  const connectInstancePromise = useMemo(() => {
    if (!publishableKey || !accountId) return null;
    const cacheKey = `${publishableKey}:${accountId}`;
    const existing = connectInstanceByAccount.get(cacheKey);
    if (existing) return existing;

    const created = loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const inFlight = clientSecretRequestByAccount.get(cacheKey);
        if (inFlight) return inFlight;

        const request = (async () => {
          const res = await paymentClient.accountSession();
          if (!res.client_secret) throw new Error("Missing client_secret in response");
          return res.client_secret;
        })();

        clientSecretRequestByAccount.set(cacheKey, request);
        try {
          return await request;
        } finally {
          clientSecretRequestByAccount.delete(cacheKey);
        }
      },
    });
    connectInstanceByAccount.set(cacheKey, created);
    return created;
  }, [publishableKey, accountId]);

  if (!publishableKey || !connectInstancePromise) {
    return <div style={{ padding: 16 }}>Missing VITE_STRIPE_PUBLISHABLE_KEY</div>;
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstancePromise}>
      {children}
    </ConnectComponentsProvider>
  );
}
