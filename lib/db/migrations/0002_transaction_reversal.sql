-- Phase 2: immutable transaction lifecycle metadata.
-- Existing transactions remain completed; no business rows are deleted.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE production
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS reversal_of_id integer;

ALTER TABLE purchases ADD CONSTRAINT purchases_status_check CHECK (status IN ('completed', 'cancelled', 'reversed'));
ALTER TABLE production ADD CONSTRAINT production_status_check CHECK (status IN ('completed', 'cancelled', 'reversed'));
ALTER TABLE sales ADD CONSTRAINT sales_status_check CHECK (status IN ('completed', 'cancelled', 'reversed'));
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('completed', 'cancelled', 'reversed'));
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('completed', 'cancelled', 'reversed'));
