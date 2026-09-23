-- Phase 1: preserve existing values while moving quantities and money to NUMERIC.
-- Run this migration before deploying the updated application.
-- NUMERIC(20,6) keeps six decimal places. Legacy REAL values may already carry
-- binary floating-point approximation; that representation cannot be recovered.
-- Drizzle records this migration in __drizzle_migrations, so it is applied once.

ALTER TABLE materials
  ALTER COLUMN conversion_factor TYPE numeric(20, 6) USING conversion_factor::numeric,
  ALTER COLUMN minimum_stock TYPE numeric(20, 6) USING minimum_stock::numeric,
  ALTER COLUMN average_cost TYPE numeric(20, 6) USING average_cost::numeric;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS packaging_bottles integer NOT NULL DEFAULT 1;

ALTER TABLE suppliers
  ALTER COLUMN opening_balance TYPE numeric(20, 6) USING opening_balance::numeric;

ALTER TABLE customers
  ALTER COLUMN opening_balance TYPE numeric(20, 6) USING opening_balance::numeric,
  ALTER COLUMN credit_limit TYPE numeric(20, 6) USING credit_limit::numeric;

ALTER TABLE products
  ALTER COLUMN bottle_size TYPE numeric(20, 6) USING bottle_size::numeric,
  ALTER COLUMN selling_price TYPE numeric(20, 6) USING selling_price::numeric,
  ALTER COLUMN average_cost TYPE numeric(20, 6) USING average_cost::numeric;

ALTER TABLE product_bom
  ALTER COLUMN quantity TYPE numeric(20, 6) USING quantity::numeric;

ALTER TABLE purchases
  ALTER COLUMN quantity TYPE numeric(20, 6) USING quantity::numeric,
  ALTER COLUMN base_quantity TYPE numeric(20, 6) USING base_quantity::numeric,
  ALTER COLUMN price TYPE numeric(20, 6) USING price::numeric,
  ALTER COLUMN total TYPE numeric(20, 6) USING total::numeric;

ALTER TABLE production
  ALTER COLUMN unit_cost TYPE numeric(20, 6) USING unit_cost::numeric,
  ALTER COLUMN total_cost TYPE numeric(20, 6) USING total_cost::numeric;

ALTER TABLE sales
  ALTER COLUMN selling_price TYPE numeric(20, 6) USING selling_price::numeric,
  ALTER COLUMN revenue TYPE numeric(20, 6) USING revenue::numeric,
  ALTER COLUMN cogs TYPE numeric(20, 6) USING cogs::numeric,
  ALTER COLUMN gross_profit TYPE numeric(20, 6) USING gross_profit::numeric,
  ALTER COLUMN paid_amount TYPE numeric(20, 6) USING paid_amount::numeric,
  ALTER COLUMN balance_due TYPE numeric(20, 6) USING balance_due::numeric;

ALTER TABLE payments
  ALTER COLUMN amount TYPE numeric(20, 6) USING amount::numeric;

ALTER TABLE expenses
  ALTER COLUMN amount TYPE numeric(20, 6) USING amount::numeric;

ALTER TABLE stock_transactions
  ALTER COLUMN quantity_in TYPE numeric(20, 6) USING quantity_in::numeric,
  ALTER COLUMN quantity_out TYPE numeric(20, 6) USING quantity_out::numeric;

UPDATE stock_transactions AS st
SET unit = m.base_unit
FROM materials AS m
WHERE st.material_id = m.id;
