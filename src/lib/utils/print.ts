import { createClient } from '@/lib/supabase/client'
import { STATIONS } from '@/lib/constants'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { StationType } from '@/types/database'

const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:9100'

interface KOTPrintRequest {
  printerIp: string
  printerPort?: number
  kotNumber: string
  orderNumber: string
  tableName: string | null
  orderType: 'dine_in' | 'takeaway'
  stationName: string
  items: { name: string; quantity: number; variant?: string; notes?: string }[]
  notes?: string
}

interface BillPrintRequest {
  printerIp: string
  printerPort?: number
  cafeName?: string
  cafeAddress?: string
  gstNumber?: string
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

    const payload: KOTPrintRequest = {
      printerIp: printer.ip,
      printerPort: printer.port,
      kotNumber,
      orderNumber,
      tableName,
      orderType,
      stationName: stationLabel,
      items,
      notes: orderNotes,
    }

    const response = await fetch(`${PRINT_SERVER_URL}/print/kot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error(`KOT print failed for ${station}:`, err.error)
      return false
    }

    return true
  } catch (err) {
    console.error(`KOT print error for ${station}:`, err)
    return false
  }
}

// Print bill/receipt on cashier printer
export async function printBill(billData: Omit<BillPrintRequest, 'printerIp' | 'printerPort'>): Promise<boolean> {
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

    const payload: BillPrintRequest = {
      ...billData,
      printerIp: printer.ip,
      printerPort: printer.port,
      cafeName: settingsMap.get('cafe_name') || 'Le Vantage Cafe',
      cafeAddress: settingsMap.get('cafe_address') || '',
      gstNumber: settingsMap.get('gst_number') || '',
    }

    const response = await fetch(`${PRINT_SERVER_URL}/print/bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Bill print failed:', err.error)
      return false
    }

    return true
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

    const response = await fetch(`${PRINT_SERVER_URL}/print/open-drawer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerIp: printer.ip, printerPort: printer.port }),
    })

    return response.ok
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
    const response = await fetch(`${PRINT_SERVER_URL}/print/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerIp, printerPort }),
    })

    return response.ok
  } catch {
    return false
  }
}

// Check if print server is running
export async function checkPrintServer(): Promise<boolean> {
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}
