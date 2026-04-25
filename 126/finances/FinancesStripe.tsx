import { useEffect, useState } from "react";
import { StripeConnectProvider } from "../../stripe/connect";
import { ConnectNotificationBanner, ConnectPayouts } from "@stripe/react-connect-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Warning, Check, Wallet, ArrowSquareOut } from "@phosphor-icons/react";
import { paymentClient, type StripeConnectHealth } from "@/stripe/client";

export default function FinancesStripe() {
  const [activeTab, setActiveTab] = useState("overview");
  const [status, setStatus] = useState<StripeConnectHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await paymentClient.stripeStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!publishableKey) {
    return (
      <Card className="p-4 border-destructive bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <Warning size={20} />
          <span>Missing VITE_STRIPE_PUBLISHABLE_KEY - Stripe features disabled</span>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not onboarded yet
  if (!status || !status.connected || !status.details_submitted) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Stripe Setup Required</span>
        </div>
        <p className="text-muted-foreground mb-4">
          Complete Stripe onboarding to start accepting payments and manage your finances.
        </p>
        <Button onClick={() => nav("/stripe/onboarding")}>
          <ArrowSquareOut size={16} className="mr-2" />
          Complete Stripe Setup
        </Button>
      </Card>
    );
  }

  // Account exists but not fully enabled
  if (!status.charges_enabled) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Action Required</span>
        </div>
        <p className="text-muted-foreground mb-4">
          Your Stripe account needs additional information before you can accept payments.
        </p>
        <Button onClick={() => nav("/stripe/onboarding")}>
          <ArrowSquareOut size={16} className="mr-2" />
          Complete Setup
        </Button>
      </Card>
    );
  }

  return (
    <StripeConnectProvider accountId={status.stripe_account_id!}>
      <div className="space-y-4">
        <ConnectNotificationBanner />
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Check size={16} />
              Overview
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <Wallet size={16} />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <Check size={24} weight="bold" />
                <span className="text-lg font-semibold">Stripe Account Active</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Charges</p>
                  <Badge variant={status.charges_enabled ? "default" : "secondary"} className="mt-1">
                    {status.charges_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Payouts</p>
                  <Badge variant={status.payouts_enabled ? "default" : "secondary"} className="mt-1">
                    {status.payouts_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Details</p>
                  <Badge variant={status.details_submitted ? "default" : "secondary"} className="mt-1">
                    {status.details_submitted ? "Submitted" : "Pending"}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Account ID</p>
                  <p className="text-xs font-mono mt-1 truncate">{status.stripe_account_id}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Your Stripe account is connected and ready. Use Finances &gt; Payments for owner activity, and use this tab for Stripe account and payout operations.
              </p>
              {status.last_webhook_sync_at && (
                <p className="text-xs text-muted-foreground mt-2">Last webhook sync: {new Date(status.last_webhook_sync_at).toLocaleString()}</p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Wallet size={20} />
                Payouts
              </h3>
              <ConnectPayouts />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </StripeConnectProvider>
  );
}
