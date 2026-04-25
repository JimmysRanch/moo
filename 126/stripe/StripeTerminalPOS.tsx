import { useState } from "react";
import { loadStripeTerminal, Terminal } from "@stripe/terminal-js";
import { paymentClient } from "./client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, Warning, Lightning } from "@phosphor-icons/react";

export function StripeTerminalPOS() {
  const [status, setStatus] = useState<string>("idle");
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string>("50.00");
  const [error, setError] = useState<string | null>(null);

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

  if (!publishableKey) {
    return (
      <Card className="p-4 border-destructive bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <Warning size={20} />
          <span>Missing VITE_STRIPE_PUBLISHABLE_KEY - Stripe Terminal disabled</span>
        </div>
      </Card>
    );
  }


  async function initTerminal() {
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
        const { secret } = await paymentClient.terminalConnectionToken();
        return secret;
      },
      onUnexpectedReaderDisconnect: () => setStatus("reader disconnected"),
    });
    setTerminal(term);
    setStatus("terminal ready");
    return term;
  }

  async function connectSimulatedReader() {
    try {
      setError(null);
      const term = terminal ?? (await initTerminal());
      if (!term) return;
      setStatus("discovering readers");
      const discover = await term.discoverReaders({ simulated: true });
      if (discover.error) throw new Error(discover.error.message);
      const reader = discover.discoveredReaders?.[0];
      if (!reader) throw new Error("No readers found");
      setStatus("connecting reader");
      const conn = await term.connectReader(reader);
      if (conn.error) throw new Error(conn.error.message);
      setStatus("reader connected");
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
      
      // Convert dollars to cents safely avoiding floating-point precision issues
      const parts = chargeAmount.split('.');
      const dollars = parseInt(parts[0] || '0', 10);
      const cents = parts[1] ? parseInt(parts[1].padEnd(2, '0').slice(0, 2), 10) : 0;
      const totalCents = dollars * 100 + cents;
      
      if (isNaN(totalCents) || totalCents <= 0 || totalCents < 50) {
        setError("Invalid amount (minimum $0.50)");
        return;
      }

      setStatus("creating payment intent");
      const { client_secret, payment_intent_id } = await paymentClient.createTerminalIntent(totalCents, "usd");

      setStatus("collecting payment method");
      const collect = await term.collectPaymentMethod(client_secret);
      if (collect.error) throw new Error(collect.error.message);

      setStatus("processing payment");
      const process = await term.processPayment(collect.paymentIntent!);
      if (process.error) throw new Error(process.error.message);

      // If manual capture, capture server-side.
      if (process.paymentIntent?.status === "requires_capture") {
        setStatus("capturing");
        await paymentClient.captureIntent(payment_intent_id);
      }

      setStatus("succeeded");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const isConnected = status === "reader connected" || status === "succeeded";
  const isProcessing = ["loading terminal", "discovering readers", "connecting reader", "creating payment intent", "collecting payment method", "processing payment", "capturing"].includes(status);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard size={20} className="text-primary" />
        <h3 className="font-semibold">Stripe Terminal (Card Present)</h3>
      </div>

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

        <Button 
          onClick={connectSimulatedReader} 
          disabled={isProcessing || isConnected}
          variant="outline"
          className="w-full"
        >
          <Lightning className="mr-2" size={16} />
          Connect Simulated Reader
        </Button>

        <div className="space-y-2">
          <Label htmlFor="charge-amount">Charge Amount ($)</Label>
          <Input
            id="charge-amount"
            type="number"
            min="0.50"
            step="0.01"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            placeholder="50.00"
          />
        </div>

        <Button 
          onClick={takePayment} 
          disabled={isProcessing || !isConnected}
          className="w-full"
        >
          <CreditCard className="mr-2" size={16} />
          Charge ${chargeAmount || "0.00"}
        </Button>
      </div>
    </Card>
  );
}
