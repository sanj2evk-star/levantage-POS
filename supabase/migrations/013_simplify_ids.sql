-- Migration 013: Simplify order and bill numbers
-- Old: ORD-20260313-042, BILL-20260313-015
-- New: #042, B-042 (shorter, human-friendly, date implicit)

-- Simplify order number: #001, #002, etc.
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN order_number LIKE '#%' THEN CAST(SUBSTRING(order_number FROM 2) AS INTEGER)
      WHEN order_number LIKE 'ORD-%' THEN CAST(SUBSTRING(order_number FROM 'ORD-[0-9]+-([0-9]+)') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO seq_num
  FROM orders
  WHERE DATE(created_at) = today_date;

  RETURN '#' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Simplify bill number: B-001, B-002, etc.
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN bill_number LIKE 'B-%' THEN CAST(SUBSTRING(bill_number FROM 3) AS INTEGER)
      WHEN bill_number LIKE 'BILL-%' THEN CAST(SUBSTRING(bill_number FROM 'BILL-[0-9]+-([0-9]+)') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO seq_num
  FROM bills
  WHERE DATE(created_at) = today_date;

  RETURN 'B-' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
