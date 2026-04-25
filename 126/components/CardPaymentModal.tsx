import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { paymentClient, type StripeSaleMetadata } from "@/stripe/client";
import { CreditCard, QrCode, DeviceMobile, Check, Warning, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { loadStripeTerminal, Terminal } from "@stripe/terminal-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface CardPaymentModalProps {
  open: boolean;
  onClose: () => void;
  amountCents: number;
  onSuccess: (paymentIntentId: string, chargeId?: string, method?: string) => void;
  onLinkCreated?: (sessionId: string, url: string) => void;
  description?: string;
  paymentMetadata?: StripeSaleMetadata;
  enabledOptions?: {
    terminal: boolean;
    manual: boolean;
    link: boolean;
  };
}

function ManualCardForm({ amountCents, onSuccess, onCancel }: { 
  amountCents: number; 
  onSuccess: (paymentIntentId: string, chargeId?: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Failed to submit payment");
        setProcessing(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "Payment failed");
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent.id, paymentIntent.charges?.data[0]?.id);
      } else {
        setError("Payment not completed");
        setProcessing(false);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
      
      <PaymentElement />
      
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || processing} className="flex-1">
          {processing ? "Processing..." : `Pay $${(amountCents / 100).toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
}

function TerminalPayment({ 
  amountCents, 
  onSuccess, 
  onCancel,
  paymentMetadata,
}: { 
  amountCents: number;
  onSuccess: (paymentIntentId: string, chargeId?: string) => void;
  onCancel: () => void;
  paymentMetadata?: StripeSaleMetadata;
}) {
  const [status, setStatus] = useState<string>("idle");
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedLocationId, setSavedLocationId] = useState<string | null>(null);
  const [savedReaderId, setSavedReaderId] = useState<string | null>(null);
  const [simulatedMode, setSimulatedMode] = useState<boolean>(typeof window !== "undefined" ? window.location.hostname === "localhost" : true);
  const terminalSupported = typeof window !== "undefined" && !/iPad|iPhone|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    let active = true;
    void paymentClient.getPosSettings()
      .then((response) => {
        if (!active) return;
        const settings = response.settings as Record<string, unknown>;
        setSavedLocationId(typeof settings.terminal_location_id === "string" ? settings.terminal_location_id : null);
        setSavedReaderId(typeof settings.connected_reader_id === "string" ? settings.connected_reader_id : null);
        if (typeof settings.terminal_simulated_mode === "boolean") {
          setSimulatedMode(settings.terminal_simulated_mode);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function initTerminal() {
    if (!terminalSupported) {
      setError("Terminal pairing is not supported in this browser. Use Manual Entry or Payment Link on this device.")
      setStatus("unsupported")
      return null
    }
    setError(null);
    setStatus("loading terminal");
    const StripeTerminal = await loadStripeTerminal();
    if (!StripeTerminal) {
      setError("Failed to load Stripe Terminal SDK");
      setStatus("error");
      return null;
    }
    const term = StripeTerminal.create({
      onFetchConnectionToken: async () => {
        const { secret } = await paymentClient.terminalConnectionToken(savedLocationId ?? undefined);
        return secret;
      },
      onUnexpectedReaderDisconnect: () => setStatus("reader disconnected"),
    });
    setTerminal(term);
    return term;
  }

  async function connectSimulatedReader() {
    try {
      setError(null);
      const term = terminal ?? (await initTerminal());
      if (!term) return;
      setStatus("discovering readers");
      const discover = await (term as Terminal & { discoverReaders: (options: Record<string, unknown>) => Promise<{ error?: { message: string }; discoveredReaders?: Array<{ id?: string; label?: string }> }> })
        .discoverReaders({ simulated: simulatedMode, ...(savedLocationId ? { location: savedLocationId } : {}) });
      if (discover.error) throw new Error(discover.error.message);
      const reader = discover.discoveredReaders?.find((candidate) => candidate.id === savedReaderId) ?? discover.discoveredReaders?.[0];
      if (!reader) throw new Error("No readers found");
      setStatus("connecting reader");
      const conn = await term.connectReader(reader);
      if (conn.error) throw new Error(conn.error.message);
      setStatus("reader connected");
      if (typeof reader.id === "string") {
        await paymentClient.saveTerminalReader({
          readerId: reader.id,
          label: typeof reader.label === "string" ? reader.label : undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  async function takePayment() {
    try {
      setError(null);
      const term = terminal ?? (await initTerminal());
      if (!term) return;

      setStatus("creating payment intent");
      const { client_secret, payment_intent_id } = await paymentClient.createTerminalIntent(amountCents, "usd", paymentMetadata);

      setStatus("collecting payment method");
      const collect = await term.collectPaymentMethod(client_secret);
      if (collect.error) throw new Error(collect.error.message);

      setStatus("processing payment");
      const process = await term.processPayment(collect.paymentIntent!);
      if (process.error) throw new Error(process.error.message);

      if (process.paymentIntent?.status === "succeeded") {
        setStatus("succeeded");
        onSuccess(payment_intent_id, process.paymentIntent.charges?.data[0]?.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const isConnected = status === "reader connected" || status === "succeeded";
  const isProcessing = ["loading terminal", "discovering readers", "connecting reader", 
    "creating payment intent", "collecting payment method", "processing payment"].includes(status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={isConnected ? "default" : "secondary"}>
          {status === "idle" ? "Not connected" : status}
        </Badge>
        {status === "succeeded" && <Check size={16} className="text-green-500" />}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {!isConnected && (
        <Button 
          onClick={connectSimulatedReader} 
          disabled={isProcessing || !terminalSupported}
          variant="outline"
          className="w-full"
        >
          {terminalSupported ? "Connect Simulated Reader" : "Terminal Not Supported"}
        </Button>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={onCancel} 
          variant="outline" 
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          onClick={takePayment} 
          disabled={isProcessing || !isConnected || status === "succeeded"}
          className="flex-1"
        >
          {isProcessing ? "Processing..." : `Charge $${(amountCents / 100).toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}

function PaymentLinkGenerator({ 
  amountCents, 
  description,
  onLinkCreated,
  paymentMetadata,
  onCancel 
}: { 
  amountCents: number;
  description?: string;
  onLinkCreated?: (sessionId: string, linkUrl: string) => void;
  onCancel: () => void;
  paymentMetadata?: StripeSaleMetadata;
}) {
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateLink() {
    setGenerating(true);
    setError(null);
    try {
      const { url, sessionId } = await paymentClient.createPaymentLink(amountCents, description || "Salon Payment", paymentMetadata);
      setLink(url);
      onLinkCreated?.(sessionId, url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate payment link";
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  }

  function copyLink() {
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard!");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {!link ? (
        <>
          <p className="text-sm text-muted-foreground">
            Generate a payment link that can be sent to the customer for online payment.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={generateLink} disabled={generating} className="flex-1">
              {generating ? "Generating..." : "Generate Link"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground">Payment Link</Label>
            <div className="mt-1 text-sm break-all">{link}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink} className="flex-1">
              <Copy size={16} className="mr-2" />
              Copy Link
            </Button>
            <Button onClick={() => window.open(link, "_blank")} className="flex-1">
              Open Link
            </Button>
          </div>
          <Button variant="ghost" onClick={onCancel} className="w-full">
            Done
          </Button>
        </>
      )}
    </div>
  );
}

export function CardPaymentModal({ 
  open, 
  onClose, 
  amountCents, 
  onSuccess,
  onLinkCreated,
  description,
  paymentMetadata,
  enabledOptions = { terminal: true, manual: true, link: true },
}: CardPaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("terminal");
  const availableTabs = [
    enabledOptions.terminal ? "terminal" : null,
    enabledOptions.manual ? "manual" : null,
    enabledOptions.link ? "link" : null,
  ].filter(Boolean) as string[];

  const createPaymentIntent = useCallback(async () => {
    setLoading(true);
    try {
      const { clientSecret: secret } = await paymentClient.createIntent(amountCents, description, paymentMetadata);
      setClientSecret(secret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize payment";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [amountCents, description, paymentMetadata]);

  useEffect(() => {
    if (open && activeTab === "manual" && !clientSecret) {
      createPaymentIntent();
    }
  }, [open, activeTab, clientSecret, createPaymentIntent]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || "manual")
    }
  }, [activeTab, availableTabs])

  function handleSuccess(paymentIntentId: string, chargeId?: string, method?: string) {
    // Map activeTab to proper stripePaymentMethod values
    const paymentMethodMap: Record<string, 'card-present' | 'manual-entry' | 'online-deposit'> = {
      'terminal': 'card-present',
      'manual': 'manual-entry',
      'link': 'online-deposit'
    };
    const stripeMethod = method || paymentMethodMap[activeTab] || 'manual-entry';
    onSuccess(paymentIntentId, chargeId, stripeMethod);
    onClose();
  }

  if (!publishableKey) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stripe Not Configured</DialogTitle>
          </DialogHeader>
          <Card className="p-4 border-destructive bg-destructive/10">
            <div className="flex items-center gap-2 text-destructive">
              <Warning size={20} />
              <span>Complete Stripe onboarding to accept card payments</span>
            </div>
          </Card>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Card Payment - ${(amountCents / 100).toFixed(2)}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${availableTabs.length <= 1 ? "grid-cols-1" : availableTabs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {enabledOptions.terminal && (
              <TabsTrigger value="terminal">
                <CreditCard size={16} className="mr-1" />
                <span className="hidden sm:inline">Terminal</span>
              </TabsTrigger>
            )}
            {enabledOptions.manual && (
              <TabsTrigger value="manual">
                <DeviceMobile size={16} className="mr-1" />
                <span className="hidden sm:inline">Manual</span>
              </TabsTrigger>
            )}
            {enabledOptions.link && (
              <TabsTrigger value="link">
                <QrCode size={16} className="mr-1" />
                <span className="hidden sm:inline">Link</span>
              </TabsTrigger>
            )}
          </TabsList>

          {enabledOptions.terminal && (
            <TabsContent value="terminal" className="mt-4">
              <TerminalPayment 
                amountCents={amountCents} 
                onSuccess={handleSuccess}
                onCancel={onClose}
                paymentMetadata={paymentMetadata}
              />
            </TabsContent>
          )}

          {enabledOptions.manual && (
            <TabsContent value="manual" className="mt-4">
              {loading && <div className="text-center py-4">Loading...</div>}
              {!loading && clientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <ManualCardForm 
                    amountCents={amountCents}
                    onSuccess={handleSuccess}
                    onCancel={onClose}
                  />
                </Elements>
              )}
            </TabsContent>
          )}

          {enabledOptions.link && (
            <TabsContent value="link" className="mt-4">
              <PaymentLinkGenerator 
                amountCents={amountCents}
                description={description}
                onLinkCreated={(sessionId, url) => {
                  toast.success("Payment link generated!");
                  onLinkCreated?.(sessionId, url);
                }}
                onCancel={onClose}
                paymentMetadata={paymentMetadata}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
