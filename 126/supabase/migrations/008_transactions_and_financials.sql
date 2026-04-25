-- Migration 008: Transactions and financial records
-- Purpose: Add tables for transactions, transaction items, expenses, and payment records

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  discount_description TEXT,
  additional_fees NUMERIC DEFAULT 0,
  additional_fees_description TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  tip_amount NUMERIC DEFAULT 0,
  tip_payment_method TEXT,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'refund', 'adjustment')),
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create transaction_items table
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product', 'addon', 'other')),
  quantity NUMERIC NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  vendor TEXT,
  description TEXT,
  payment_method TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create payment_records table (for non-Stripe payments)
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON public.transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_appointment_id ON public.transactions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON public.expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_payment_records_store_id ON public.payment_records(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON public.payment_records(date);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Members can view transactions in their store"
  ON public.transactions FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert transactions in their store"
  ON public.transactions FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update transactions in their store"
  ON public.transactions FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete transactions in their store"
  ON public.transactions FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for transaction_items
CREATE POLICY "Members can view transaction items in their store"
  ON public.transaction_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND public.is_store_member(t.store_id)
    )
  );

CREATE POLICY "Members can insert transaction items in their store"
  ON public.transaction_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND public.is_store_member(t.store_id)
    )
  );

CREATE POLICY "Members can update transaction items in their store"
  ON public.transaction_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND public.is_store_member(t.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND public.is_store_member(t.store_id)
    )
  );

CREATE POLICY "Members can delete transaction items in their store"
  ON public.transaction_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND public.is_store_member(t.store_id)
    )
  );

-- RLS Policies for expenses
CREATE POLICY "Members can view expenses in their store"
  ON public.expenses FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert expenses in their store"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update expenses in their store"
  ON public.expenses FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete expenses in their store"
  ON public.expenses FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for payment_records
CREATE POLICY "Members can view payment records in their store"
  ON public.payment_records FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert payment records in their store"
  ON public.payment_records FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update payment records in their store"
  ON public.payment_records FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete payment records in their store"
  ON public.payment_records FOR DELETE
  USING (public.is_store_owner(store_id));

-- Add updated_at triggers
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
