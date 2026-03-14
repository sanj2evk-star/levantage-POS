-- 018: Bill improvements
-- 1. Simplify bill numbers to daily sequential (1, 2, 3...)
-- 2. Add bill_print_count to orders for reprint tracking

-- ─── Simplified bill number generator ─────────────────────────────────────────
-- Returns plain sequential numbers: '1', '2', '3'... resetting daily
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN bill_number ~ '^\d+$' THEN CAST(bill_number AS INTEGER)
      WHEN bill_number LIKE 'B-%' THEN CAST(SUBSTRING(bill_number FROM 3) AS INTEGER)
      WHEN bill_number LIKE 'BILL-%' THEN CAST(SUBSTRING(bill_number FROM 'BILL-[0-9]+-([0-9]+)') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO seq_num
  FROM bills
  WHERE DATE(created_at) = today_date;

  RETURN seq_num::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ─── Bill print count on orders ───────────────────────────────────────────────
-- Tracks how many times a preview bill was printed for this order.
-- If > 1, it means the bill was reprinted (flagged in Hawkeye audit).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_print_count INTEGER NOT NULL DEFAULT 0;
