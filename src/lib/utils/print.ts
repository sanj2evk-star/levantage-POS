import { createClient } from '@/lib/supabase/client'
import { STATIONS } from '@/lib/constants'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { StationType } from '@/types/database'

interface KOTPayload {
  kotNumber: string
  orderNumber: string
  tableName: string | null
  orderType: 'dine_in' | 'takeaway'
  stationName: string
  items: { name: string; quantity: number; variant?: string; notes?: string }[]
  notes?: string
}

interface BillPayload {
  billNumber: string
  orderNumber: string
  tableName: string | null
  orderType: 'dine_in' | 'takeaway'
  items: { name: string; quantity: number; unitPrice: number; variant?: string }[]
  subtotal: number
  gstPercent: number
  gstAmount: number
  serviceCharge: number
  discountAmount: number
  discountType: string
  discountReason?: string
  serviceChargeRemoved?: boolean
  isReprint?: boolean
  total: number
  paymentMode: string | null
  payments?: { mode: string; amount: number }[]
  cafeName?: string
  cafeAddress?: string
  gstNumber?: string
}

// Get printer configuration for a station from the database
async function getPrinterForStation(station: StationType): Promise<{ ip: string; port: number } | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('print_stations')
    .select('printer_ip, port')
    .eq('station_type', station)
    .eq('is_active', true)
    .single()

  if (!data) return null
  return { ip: data.printer_ip, port: data.port }
}

// Insert a print job into Supabase for the print proxy to pick up
async function insertPrintJob(
  type: 'kot' | 'bill' | 'open_drawer' | 'test',
  printerIp: string,
  printerPort: number,
  payload: Record<string, unknown>
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('print_jobs').insert({
    type,
    printer_ip: printerIp,
    printer_port: printerPort,
    payload,
  })

  if (error) {
    console.error(`Failed to insert print job (${type}):`, error.message)
    return false
  }

  return true
}

// Send KOT to the appropriate station printer
export async function printKOT(
  station: StationType,
  kotNumber: string,
  orderNumber: string,
  tableNumber: number | null,
  tableSection: string | null,
  orderType: 'dine_in' | 'takeaway',
  items: { name: string; quantity: number; variant?: string; notes?: string }[],
  orderNotes?: string
): Promise<boolean> {
  try {
    const printer = await getPrinterForStation(station)
    if (!printer) {
      console.warn(`No printer configured for station: ${station}`)
      return false
    }

    const stationLabel = STATIONS.find(s => s.value === station)?.label || station
    const tableName = tableNumber && tableSection
      ? getTableDisplayName({ number: tableNumber, section: tableSection })
      : null

    const payload: KOTPayload = {
      kotNumber,
      orderNumber,
      tableName,
      orderType,
      stationName: stationLabel,
      items,
      notes: orderNotes,
    }

    return await insertPrintJob('kot', printer.ip, printer.port, payload as unknown as Record<string, unknown>)
  } catch (err) {
    console.error(`KOT print error for ${station}:`, err)
    return false
  }
}

// Print bill/receipt on cashier printer
export async function printBill(billData: Omit<BillPayload, 'cafeName' | 'cafeAddress' | 'gstNumber'>): Promise<boolean> {
  try {
    const printer = await getPrinterForStation('billing' as StationType)
    if (!printer) {
      console.warn('No billing printer configured')
      return false
    }

    // Get cafe settings
    const supabase = createClient()
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['cafe_name', 'cafe_address', 'gst_number'])

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])

    const payload: BillPayload = {
      ...billData,
      cafeName: settingsMap.get('cafe_name') || 'Le Vantage Cafe',
      cafeAddress: settingsMap.get('cafe_address') || '',
      gstNumber: settingsMap.get('gst_number') || '',
    }

    return await insertPrintJob('bill', printer.ip, printer.port, payload as unknown as Record<string, unknown>)
  } catch (err) {
    console.error('Bill print error:', err)
    return false
  }
}

// Open cash drawer (connected to billing printer)
export async function openCashDrawer(): Promise<boolean> {
  try {
    const printer = await getPrinterForStation('billing' as StationType)
    if (!printer) {
      console.warn('No billing printer configured for cash drawer')
      return false
    }

    return await insertPrintJob('open_drawer', printer.ip, printer.port, {})
  } catch (err) {
    console.error('Cash drawer error:', err)
    return false
  }
}

// Reprint KOT for existing order items at a station
export async function reprintKOT(
  station: StationType,
  kotNumber: string,
  orderNumber: string,
  tableNumber: number | null,
  tableSection: string | null,
  orderType: 'dine_in' | 'takeaway',
  items: { name: string; quantity: number; variant?: string; notes?: string }[],
  orderNotes?: string
): Promise<boolean> {
  return printKOT(station, `${kotNumber} (REPRINT)`, orderNumber, tableNumber, tableSection, orderType, items, orderNotes)
}

// Test printer connection
export async function testPrinter(printerIp: string, printerPort: number = 9100): Promise<boolean> {
  try {
    return await insertPrintJob('test', printerIp, printerPort, {})
  } catch {
    return false
  }
}

// Check if print proxy is alive by looking for stale pending jobs
export async function checkPrintServer(): Promise<boolean> {
  try {
    const supabase = createClient()
    // Check if there are stale pending jobs (proxy not picking them up)
    const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    const { data: staleJobs } = await supabase
      .from('print_jobs')
      .select('id')
      .eq('status', 'pending')
      .lt('created_at', thirtySecsAgo)
      .limit(1)
    // If there are stale pending jobs, proxy is likely down
    return !staleJobs || staleJobs.length === 0
  } catch {
    return false
  }
}
