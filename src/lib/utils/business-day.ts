/**
 * Business Day Utilities
 *
 * A "business day" starts at the configured boundary hour (e.g., 3 AM)
 * and ends at the same hour the next calendar day.
 *
 * Example with boundaryHour = 3:
 *   Business day "2026-03-14" runs from 2026-03-14 03:00:00 → 2026-03-15 02:59:59
 *   At 1 AM on Mar 15, you are still in business day "Mar 14"
 *   At 4 AM on Mar 15, you are in business day "Mar 15"
 */

/** Format a Date as YYYY-MM-DD */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the ISO date range for a business day.
 *
 * @param dateStr - The business date in YYYY-MM-DD format
 * @param boundaryHour - The hour (0-5) when a new business day starts (default 3 = 3 AM)
 * @returns { start: ISO string, end: ISO string }
 */
export function getBusinessDayRange(dateStr: string, boundaryHour: number = 3): { start: string; end: string } {
  // If boundary is 0 (midnight), use classic midnight-to-midnight
  if (boundaryHour === 0) {
    const start = new Date(dateStr + 'T00:00:00').toISOString()
    const end = new Date(dateStr + 'T23:59:59').toISOString()
    return { start, end }
  }

  // Business day starts at boundaryHour on the given date
  const startDate = new Date(dateStr + 'T00:00:00')
  startDate.setHours(boundaryHour, 0, 0, 0)
  const start = startDate.toISOString()

  // Business day ends at boundaryHour - 1 second on the next calendar day
  const endDate = new Date(dateStr + 'T00:00:00')
  endDate.setDate(endDate.getDate() + 1)
  endDate.setHours(boundaryHour - 1, 59, 59, 999)
  const end = endDate.toISOString()

  return { start, end }
}

/**
 * Get the current business date as YYYY-MM-DD.
 *
 * If the current time is before the boundary hour, the business date is
 * yesterday's calendar date (we're still in yesterday's business day).
 *
 * @param boundaryHour - The hour (0-5) when a new business day starts
 * @returns YYYY-MM-DD string
 */
export function getCurrentBusinessDate(boundaryHour: number = 3): string {
  const now = new Date()

  // If boundary is 0, just return today
  if (boundaryHour === 0) return fmtDate(now)

  // If current hour < boundary, we're still in yesterday's business day
  if (now.getHours() < boundaryHour) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return fmtDate(yesterday)
  }

  return fmtDate(now)
}

/**
 * Load the day_boundary_hour setting from Supabase.
 * Returns the hour number (default 3 if not found).
 */
export async function loadDayBoundaryHour(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'day_boundary_hour')
    .single()

  const hour = parseInt(data?.value || '3', 10)
  return isNaN(hour) ? 3 : Math.max(0, Math.min(5, hour))
}
