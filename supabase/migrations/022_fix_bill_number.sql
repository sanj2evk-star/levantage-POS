-- 022: Fix bill number generator
-- The previous function failed when BILL-timestamp format bill numbers existed
-- because 'BILL-1773...' matched the 'B-%' LIKE pattern, causing a CAST error.
-- This version is simple and robust: just count today's bills + 1.
-- SECURITY DEFINER ensures it bypasses RLS.

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM bills
  WHERE created_at::date = CURRENT_DATE;

  RETURN seq_num::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
