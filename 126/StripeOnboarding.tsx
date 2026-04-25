import { useEffect, useState } from "react";
import { StripeConnectProvider } from "../stripe/connect";
import { ConnectAccountOnboarding, ConnectNotificationBanner } from "@stripe/react-connect-js";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Warning } from "@phosphor-icons/react";
import { paymentClient, type StripeConnectHealth } from "@/stripe/client";
import { useStore } from "@/contexts/StoreContext";

export default function StripeOnboardingPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StripeConnectHealth | null>(null);
  const nav = useNavigate();
  const { role } = useStore();

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

  useEffect(() => {
    if (role !== "owner" && role !== "admin") return;
    let cancelled = false;
    async function init() {
      try {
        const s = await paymentClient.stripeStatus();
        if (cancelled) return;
        setStatus(s);
        if (s.connected && s.stripe_account_id) {
          setAccountId(s.stripe_account_id);
          setAccountReady(true);
        } else {
          const data = await paymentClient.ensureConnectAccount("US");
          if (cancelled) return;
          if (!data.connectedAccountId) throw new Error("Failed to create Stripe account");
          setAccountId(data.connectedAccountId);
          setAccountReady(true);
          const updated = await paymentClient.stripeStatus();
          if (!cancelled) setStatus(updated);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    init();
    return () => { cancelled = true; };
  }, [role]);

  if (role !== "owner" && role !== "admin") {
    return (
      <div className="min-h-full bg-background p-6">
        <Card className="max-w-2xl mx-auto p-6 border-amber-500/50 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Warning size={24} />
            <span className="text-lg font-semibold">Stripe account management is limited to owners and admins</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            Ask an owner or admin to complete onboarding or manage the connected Stripe account.
          </p>
          <Button variant="outline" onClick={() => nav("/settings?tab=card")} className="mt-4">
            <ArrowLeft size={16} className="mr-2" />
            Back to Settings
          </Button>
        </Card>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="min-h-full bg-background p-6">
        <Card className="max-w-2xl mx-auto p-6 border-destructive bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <Warning size={24} />
            <span className="text-lg font-semibold">Missing VITE_STRIPE_PUBLISHABLE_KEY</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            Configure your Stripe publishable key in the environment variables to enable Stripe Connect.
          </p>
          <Button variant="outline" onClick={() => nav("/settings")} className="mt-4">
            <ArrowLeft size={16} className="mr-2" />
            Back to Settings
          </Button>
        </Card>
      </div>
    );
  }

  if (!accountId || !accountReady) {
    return (
      <div className="min-h-full bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Setting up Stripe account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-background p-6">
        <Card className="max-w-2xl mx-auto p-6 border-destructive bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <Warning size={24} />
            <span className="text-lg font-semibold">Error</span>
          </div>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => nav("/settings")} className="mt-4">
            <ArrowLeft size={16} className="mr-2" />
            Back to Settings
          </Button>
        </Card>
      </div>
    );
  }

  // If already fully onboarded, show status and button to go back
  if (status?.onboarding_complete || (status?.details_submitted && status?.charges_enabled)) {
    return (
      <div className="min-h-full bg-background p-6">
        <Card className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <Check size={24} weight="bold" />
            <span className="text-lg font-semibold">Stripe Account Active</span>
          </div>
          <p className="text-muted-foreground mb-4">
            Your Stripe account is fully set up and ready to accept payments.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => nav("/finances?tab=payouts")}>
              Go to Finances
            </Button>
            <Button variant="outline" onClick={() => nav("/settings")}>
              Back to Settings
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => nav("/settings")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Stripe Onboarding</h1>
        </div>

        <StripeConnectProvider accountId={accountId} >
          <div className="space-y-4">
            <ConnectNotificationBanner />
            <Card className="p-6">
              <ConnectAccountOnboarding
                onExit={async () => {
                  try {
                    await paymentClient.stripeStatus();
                  } catch (err) {
                    console.error("[StripeOnboarding] post-onboarding status refresh failed:", err);
                  }
                  nav("/settings");
                }}
              />
            </Card>
          </div>
        </StripeConnectProvider>
      </div>
    </div>
  );
}
