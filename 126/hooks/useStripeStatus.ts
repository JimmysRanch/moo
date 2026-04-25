import { useState, useCallback } from "react";
import { paymentClient, type StripeConnectHealth } from "@/stripe/client";

export type StripeStatusResponse = StripeConnectHealth & { ok?: boolean; warning?: string; warning_details?: string };

export function useStripeStatus(_storeId?: string) {
  const [status, setStatus] = useState<StripeStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (_storeId === "") {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await paymentClient.stripeStatus();
      setStatus(data as StripeStatusResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [_storeId]);

  return { status, loading, error, fetchStatus };
}
