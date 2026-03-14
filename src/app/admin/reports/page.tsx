'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Bill, Payment } from '@/types/database'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Download,
  FileSpreadsheet,
  ClipboardList,
  Users,
  PieChart,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getBusinessDayRange, getCurrentBusinessDate, loadDayBoundaryHour } from '@/lib/utils/business-day'

type ReportTab = 'item_sales' | 'master_sales' | 'waiter_performance' | 'payment_breakdown' | 'settlement'

interface ItemSales {
  name: string
  category: string
  quantity: number
  revenue: number
}

interface CategorySales {
  name: string
  quantity: number
  revenue: number
}

interface WaiterStats {
  id: string
  name: string
  role: string
  orders: number
  revenue: number
  avgOrderValue: number
}

interface MasterBill extends Omit<Bill, 'order' | 'payments'> {
  payments?: Payment[]
  order?: {
    order_number: string
    order_type: string
    table?: { number: number; section: string } | null
    waiter?: { id: string; name: string; role: string } | null
  }
}

interface RefundSummary {
  count: number
  total: number
  byMode: { mode: string; count: number; total: number }[]
}

interface OutstandingSummary {
  count: number
  total: number
}

interface HourlySales {
  hour: number
  count: number
  total: number
}

interface DaySummary {
  totalSales: number
  netSales: number
  totalOrders: number
  avgOrderValue: number
  totalGST: number
  totalSC: number
  totalSCRemoved: number
  totalDiscount: number
  cashTotal: number
  upiTotal: number
  cardTotal: number
  cashCount: number
  upiCount: number
  cardCount: number
  bills: MasterBill[]
  itemSales: ItemSales[]
  categorySales: CategorySales[]
  waiterStats: WaiterStats[]
  refundSummary: RefundSummary
  outstandingSummary: OutstandingSummary
  hourlySales: HourlySales[]
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReportsPage() {
  const { profile } = useAuth(['admin', 'manager', 'accountant'])
  const [dateFrom, setDateFrom] = useState(() => getCurrentBusinessDate(3))
  const [dateTo, setDateTo] = useState(() => getCurrentBusinessDate(3))
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ReportTab>('item_sales')

  const isSingleDay = dateFrom === dateTo

  const loadReport = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const bh = await loadDayBoundaryHour(supabase)
    const startOfDay = getBusinessDayRange(dateFrom, bh).start
    const endOfDay = getBusinessDayRange(dateTo, bh).end

    const [billsResult, ordersResult, refundsResult, partialBillsResult] = await Promise.all([
      supabase
        .from('bills')
        .select('*, payments(*), order:orders!order_id(order_number, order_type, table:tables!table_id(number, section), waiter:profiles!waiter_id(id, name, role))')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select(`
          id, created_at, status,
          items:order_items(
            quantity, total_price, is_cancelled,
            menu_item:menu_items(name, category:categories(name))
          )
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('status', 'completed'),
      supabase
        .from('refunds')
        .select('id, amount, refund_mode, created_at')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('bills')
        .select('id, total, created_at, payments(*)')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'partial'),
    ])

    const bills = (billsResult.data || []) as MasterBill[]
    const orders = ordersResult.data || []

    const refunds = refundsResult.data || []
    const partialBills = partialBillsResult.data || []

    // Payment breakdown
    let cashTotal = 0, upiTotal = 0, cardTotal = 0
    let cashCount = 0, upiCount = 0, cardCount = 0
    let totalGST = 0, totalSC = 0, totalSCRemoved = 0, totalDiscount = 0
    const hourlyMap = new Map<number, { count: number; total: number }>()

    bills.forEach((bill) => {
      totalGST += Number(bill.gst_amount)
      totalDiscount += Number(bill.discount_amount)
      if (bill.service_charge_removed) {
        totalSCRemoved += Number(bill.service_charge)
      } else {
        totalSC += Number(bill.service_charge)
      }
      if (bill.payments) {
        bill.payments.forEach((p: Payment) => {
          switch (p.mode) {
            case 'cash': cashTotal += Number(p.amount); cashCount++; break
            case 'upi': upiTotal += Number(p.amount); upiCount++; break
            case 'card': cardTotal += Number(p.amount); cardCount++; break
          }
        })
      }
      // Hourly sales
      const hour = new Date(bill.created_at).getHours()
      const he = hourlyMap.get(hour) || { count: 0, total: 0 }
      he.count++
      he.total += Number(bill.total)
      hourlyMap.set(hour, he)
    })
    const totalSales = bills.reduce((sum, b) => sum + Number(b.total), 0)
    const netSales = totalSales - totalGST - totalDiscount

    // Hourly sales sorted
    const hourlySales = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour)

    // Refund summary
    const refundByMode = new Map<string, { count: number; total: number }>()
    refunds.forEach((r: any) => {
      const mode = r.refund_mode || 'cash'
      const entry = refundByMode.get(mode) || { count: 0, total: 0 }
      entry.count++
      entry.total += Number(r.amount)
      refundByMode.set(mode, entry)
    })
    const refundSummary: RefundSummary = {
      count: refunds.length,
      total: refunds.reduce((s: number, r: any) => s + Number(r.amount), 0),
      byMode: Array.from(refundByMode.entries()).map(([mode, data]) => ({ mode, ...data })),
    }

    // Outstanding summary
    const outstandingTotal = partialBills.reduce((s: number, b: any) => {
      const paid = (b.payments || []).reduce((ps: number, p: any) => ps + Number(p.amount), 0)
      return s + (Number(b.total) - paid)
    }, 0)
    const outstandingSummary: OutstandingSummary = {
      count: partialBills.length,
      total: outstandingTotal,
    }

    // Item-wise and category-wise sales
    const itemMap = new Map<string, ItemSales>()
    const catMap = new Map<string, CategorySales>()

    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        if (item.is_cancelled) return
        const name = item.menu_item?.name || 'Unknown'
        const catName = item.menu_item?.category?.name || 'Uncategorized'

        const itemEntry = itemMap.get(name) || { name, category: catName, quantity: 0, revenue: 0 }
        itemEntry.quantity += item.quantity
        itemEntry.revenue += Number(item.total_price)
        itemMap.set(name, itemEntry)

        const catEntry = catMap.get(catName) || { name: catName, quantity: 0, revenue: 0 }
        catEntry.quantity += item.quantity
        catEntry.revenue += Number(item.total_price)
        catMap.set(catName, catEntry)
      })
    })

    const itemSales = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue)
    const categorySales = Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue)

    // Waiter performance stats
    const waiterMap = new Map<string, WaiterStats>()
    bills.forEach((bill) => {
      const waiter = bill.order?.waiter
      if (!waiter) return
      const entry = waiterMap.get(waiter.id) || {
        id: waiter.id,
        name: waiter.name,
        role: waiter.role,
        orders: 0,
        revenue: 0,
        avgOrderValue: 0,
      }
      entry.orders += 1
      entry.revenue += Number(bill.total)
      waiterMap.set(waiter.id, entry)
    })
    const waiterStats = Array.from(waiterMap.values())
      .map(w => ({ ...w, avgOrderValue: w.orders > 0 ? w.revenue / w.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue)

    setSummary({
      totalSales,
      netSales,
      totalOrders: bills.length,
      avgOrderValue: bills.length > 0 ? totalSales / bills.length : 0,
      totalGST,
      totalSC,
      totalSCRemoved,
      totalDiscount,
      cashTotal,
      upiTotal,
      cardTotal,
      cashCount,
      upiCount,
      cardCount,
      bills,
      itemSales,
      categorySales,
      waiterStats,
      refundSummary,
      outstandingSummary,
      hourlySales,
    })
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    if (rows.length === 0) {
      toast.error('No data to export')
      return
    }
    const csv = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  const dateSuffix = isSingleDay ? dateFrom : `${dateFrom}_to_${dateTo}`

  function exportItemSalesCSV() {
    if (!summary) return
    const headers = ['#', 'Item Name', 'Category', 'Qty Sold', 'Revenue']
    const rows = summary.itemSales.map((item, i) => [
      i + 1,
      item.name,
      item.category,
      item.quantity,
      item.revenue.toFixed(2),
    ])
    const totalQty = summary.itemSales.reduce((s, i) => s + i.quantity, 0)
    const totalRev = summary.itemSales.reduce((s, i) => s + i.revenue, 0)
    rows.push(['', 'TOTAL', '', totalQty, totalRev.toFixed(2)])
    downloadCSV(`item-sales-${dateSuffix}.csv`, headers, rows)
  }

  function exportMasterSalesCSV() {
    if (!summary) return
    const headers = ['#', 'Bill Number', 'Order #', 'Table', 'Captain', 'Time', 'Subtotal', 'GST', 'Service Charge', 'SC Removed', 'Discount', 'Net Sales', 'Total', 'Payment Mode', 'Ref #']
    const rows = summary.bills.map((bill, i) => {
      const tbl = bill.order?.table
        ? getTableDisplayName(bill.order.table)
        : bill.order?.order_type === 'takeaway' ? 'Takeaway' : '-'
      const scRemoved = bill.service_charge_removed ? 'Yes' : ''
      const netSale = Number(bill.total) - Number(bill.gst_amount) - Number(bill.discount_amount)
      const refs = (bill.payments || [])
        .filter((p: Payment) => p.reference_number)
        .map((p: Payment) => p.reference_number)
        .join('; ')
      return [
        i + 1,
        bill.bill_number,
        bill.order?.order_number || '-',
        tbl,
        bill.order?.waiter?.name || '-',
        new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        Number(bill.subtotal).toFixed(2),
        Number(bill.gst_amount).toFixed(2),
        bill.service_charge_removed ? '0.00' : Number(bill.service_charge).toFixed(2),
        scRemoved,
        Number(bill.discount_amount).toFixed(2),
        netSale.toFixed(2),
        Number(bill.total).toFixed(2),
        (bill.payment_mode || '').toUpperCase(),
        refs,
      ]
    })
    const totSubtotal = summary.bills.reduce((s, b) => s + Number(b.subtotal), 0)
    rows.push([
      '', 'TOTAL', '', '', '', '',
      totSubtotal.toFixed(2),
      summary.totalGST.toFixed(2),
      summary.totalSC.toFixed(2),
      '',
      summary.totalDiscount.toFixed(2),
      summary.netSales.toFixed(2),
      summary.totalSales.toFixed(2),
      '',
      '',
    ])
    downloadCSV(`master-sales-${dateSuffix}.csv`, headers, rows)
  }

  function exportWaiterCSV() {
    if (!summary) return
    const headers = ['#', 'Captain', 'Role', 'Orders', 'Revenue', 'Avg Order Value']
    const rows = summary.waiterStats.map((w, i) => [
      i + 1,
      w.name,
      w.role,
      w.orders,
      w.revenue.toFixed(2),
      w.avgOrderValue.toFixed(2),
    ])
    const totOrders = summary.waiterStats.reduce((s, w) => s + w.orders, 0)
    const totRev = summary.waiterStats.reduce((s, w) => s + w.revenue, 0)
    rows.push(['', 'TOTAL', '', totOrders, totRev.toFixed(2), totOrders > 0 ? (totRev / totOrders).toFixed(2) : '0.00'])
    downloadCSV(`waiter-performance-${dateSuffix}.csv`, headers, rows)
  }

  function setDatePreset(preset: 'today' | 'yesterday' | 'last7') {
    const today = new Date()
    if (preset === 'today') {
      const d = formatDate(today)
      setDateFrom(d)
      setDateTo(d)
    } else if (preset === 'yesterday') {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      const d = formatDate(y)
      setDateFrom(d)
      setDateTo(d)
    } else {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      setDateFrom(formatDate(start))
      setDateTo(formatDate(today))
    }
  }

  const isToday = isSingleDay && dateFrom === formatDate(new Date())
  const isYesterday = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return isSingleDay && dateFrom === formatDate(y) })()

  const tabs: { key: ReportTab; label: string; shortLabel: string; icon: typeof ClipboardList }[] = [
    { key: 'item_sales', label: 'Item Sales', shortLabel: 'Items', icon: ClipboardList },
    { key: 'master_sales', label: 'Master Sales', shortLabel: 'Master', icon: FileSpreadsheet },
    { key: 'waiter_performance', label: 'Captain', shortLabel: 'Captain', icon: Users },
    { key: 'payment_breakdown', label: 'Payments', shortLabel: 'Payments', icon: PieChart },
    { key: 'settlement', label: 'Settlement', shortLabel: 'Settle', icon: BarChart3 },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header + Date Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Reports</h1>
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <Link href="/admin/eod">
              <Button size="sm" variant="outline" className="gap-1.5">
                <CalendarCheck className="h-4 w-4" />
                <span className="hidden sm:inline">EOD Report</span>
                <span className="sm:hidden">EOD</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <Button
              variant={isToday ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('today')}
              className="text-xs sm:text-sm"
            >
              Today
            </Button>
            <Button
              variant={isYesterday ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('yesterday')}
              className="text-xs sm:text-sm"
            >
              Yesterday
            </Button>
            <Button
              variant={!isSingleDay ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('last7')}
              className="text-xs sm:text-sm"
            >
              Last 7 Days
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value) }}
              className="w-[130px] sm:w-36 text-xs sm:text-sm"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); if (e.target.value < dateFrom) setDateFrom(e.target.value) }}
              className="w-[130px] sm:w-36 text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
        </div>
      ) : summary ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">₹{summary.totalSales.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Net Sales</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">₹{summary.netSales.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Orders</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{summary.totalOrders}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Avg ₹{summary.avgOrderValue.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">{isSingleDay ? 'Date' : 'Period'}</span>
                </div>
                {isSingleDay ? (
                  <p className="text-lg sm:text-xl font-bold">{new Date(dateFrom + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                ) : (
                  <p className="text-sm sm:text-base font-bold">
                    {new Date(dateFrom + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(dateTo + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Report Tab Bar */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide border-b">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0',
                  activeTab === tab.key
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* =================== ITEM SALES =================== */}
          {activeTab === 'item_sales' && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-sm sm:text-base font-semibold">Item Sales Report</h3>
                  <Button variant="outline" size="sm" onClick={exportItemSalesCSV} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </Button>
                </div>
                <div className="p-4">
                  {summary.itemSales.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No item sales for this period</p>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2.5 font-medium w-10">#</th>
                              <th className="pb-2.5 font-medium">Item Name</th>
                              <th className="pb-2.5 font-medium">Category</th>
                              <th className="pb-2.5 font-medium text-right">Qty</th>
                              <th className="pb-2.5 font-medium text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.itemSales.map((item, i) => (
                              <tr key={item.name} className="border-b last:border-0">
                                <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                                <td className="py-2.5 font-medium">{item.name}</td>
                                <td className="py-2.5 text-muted-foreground">{item.category}</td>
                                <td className="py-2.5 text-right">{item.quantity}</td>
                                <td className="py-2.5 text-right font-semibold">₹{item.revenue.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-bold">
                              <td className="pt-3" colSpan={3}>Total</td>
                              <td className="pt-3 text-right">{summary.itemSales.reduce((s, i) => s + i.quantity, 0)}</td>
                              <td className="pt-3 text-right">₹{summary.itemSales.reduce((s, i) => s + i.revenue, 0).toFixed(0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Mobile card list */}
                      <div className="sm:hidden space-y-2">
                        {summary.itemSales.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                                <span className="text-sm font-medium truncate">{item.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground ml-7">{item.category}</span>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-semibold">₹{item.revenue.toFixed(0)}</p>
                              <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-3 border-t-2 font-bold text-sm">
                          <span>Total ({summary.itemSales.reduce((s, i) => s + i.quantity, 0)} items)</span>
                          <span>₹{summary.itemSales.reduce((s, i) => s + i.revenue, 0).toFixed(0)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Category breakdown */}
              {summary.categorySales.length > 0 && (
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Sales by Category</h3>
                  <div className="space-y-3">
                    {summary.categorySales.map(cat => {
                      const totalItemRev = summary.itemSales.reduce((s, i) => s + i.revenue, 0)
                      const pct = totalItemRev > 0 ? (cat.revenue / totalItemRev) * 100 : 0
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-muted-foreground text-xs sm:text-sm">
                              {cat.quantity} items · ₹{cat.revenue.toFixed(0)} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================== MASTER SALES =================== */}
          {activeTab === 'master_sales' && (
            <div className="rounded-xl border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-sm sm:text-base font-semibold">Master Sales Report</h3>
                <Button variant="outline" size="sm" onClick={exportMasterSalesCSV} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              </div>
              <div className="p-4">
                {summary.bills.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No bills for this period</p>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2.5 font-medium w-10">#</th>
                            <th className="pb-2.5 font-medium">Bill #</th>
                            <th className="pb-2.5 font-medium">Table</th>
                            <th className="pb-2.5 font-medium">Captain</th>
                            <th className="pb-2.5 font-medium">Time</th>
                            <th className="pb-2.5 font-medium text-right">Subtotal</th>
                            <th className="pb-2.5 font-medium text-right">GST</th>
                            <th className="pb-2.5 font-medium text-right">SC</th>
                            <th className="pb-2.5 font-medium text-right">Disc</th>
                            <th className="pb-2.5 font-medium text-right">Total</th>
                            <th className="pb-2.5 font-medium">Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.bills.map((bill, i) => {
                            const tbl = bill.order?.table
                              ? getTableDisplayName(bill.order.table)
                              : bill.order?.order_type === 'takeaway' ? 'TA' : '-'
                            const sc = bill.service_charge_removed ? 0 : Number(bill.service_charge)
                            return (
                              <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                                <td className="py-2.5 font-medium text-xs">{bill.bill_number}</td>
                                <td className="py-2.5">
                                  <Badge variant="outline" className="text-xs">{tbl}</Badge>
                                </td>
                                <td className="py-2.5 text-muted-foreground text-xs">{bill.order?.waiter?.name || '-'}</td>
                                <td className="py-2.5 text-muted-foreground text-xs">
                                  {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2.5 text-right text-xs">₹{Number(bill.subtotal).toFixed(0)}</td>
                                <td className="py-2.5 text-right text-xs text-muted-foreground">₹{Number(bill.gst_amount).toFixed(0)}</td>
                                <td className="py-2.5 text-right text-xs text-muted-foreground">
                                  {bill.service_charge_removed ? (
                                    <span className="text-red-400 line-through">₹{Number(bill.service_charge).toFixed(0)}</span>
                                  ) : (
                                    `₹${sc.toFixed(0)}`
                                  )}
                                </td>
                                <td className="py-2.5 text-right text-xs text-muted-foreground">
                                  {Number(bill.discount_amount) > 0 ? `-₹${Number(bill.discount_amount).toFixed(0)}` : '-'}
                                </td>
                                <td className="py-2.5 text-right font-bold text-sm">₹{Number(bill.total).toFixed(0)}</td>
                                <td className="py-2.5">
                                  <Badge variant="outline" className="text-[10px]">
                                    {bill.payment_mode?.toUpperCase()}
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-bold">
                            <td className="pt-3" colSpan={5}>Total ({summary.bills.length} bills)</td>
                            <td className="pt-3 text-right text-xs">₹{summary.bills.reduce((s, b) => s + Number(b.subtotal), 0).toFixed(0)}</td>
                            <td className="pt-3 text-right text-xs">₹{summary.totalGST.toFixed(0)}</td>
                            <td className="pt-3 text-right text-xs">₹{summary.totalSC.toFixed(0)}</td>
                            <td className="pt-3 text-right text-xs">{summary.totalDiscount > 0 ? `-₹${summary.totalDiscount.toFixed(0)}` : '-'}</td>
                            <td className="pt-3 text-right">₹{summary.totalSales.toFixed(0)}</td>
                            <td className="pt-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile/Tablet card list */}
                    <div className="lg:hidden space-y-2">
                      {summary.bills.map((bill, i) => {
                        const tbl = bill.order?.table
                          ? getTableDisplayName(bill.order.table)
                          : bill.order?.order_type === 'takeaway' ? 'TA' : '-'
                        return (
                          <div key={bill.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{i + 1}</span>
                                <span className="text-sm font-semibold">{bill.bill_number}</span>
                                <Badge variant="outline" className="text-[10px]">{tbl}</Badge>
                              </div>
                              <span className="text-sm font-bold">₹{Number(bill.total).toFixed(0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span>{new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                {bill.order?.waiter?.name && <span>· {bill.order.waiter.name}</span>}
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {bill.payment_mode?.toUpperCase()}
                              </Badge>
                            </div>
                            {(Number(bill.discount_amount) > 0 || bill.service_charge_removed) && (
                              <div className="flex items-center gap-2 mt-1.5 text-xs">
                                {Number(bill.discount_amount) > 0 && (
                                  <span className="text-red-500">Disc -₹{Number(bill.discount_amount).toFixed(0)}</span>
                                )}
                                {bill.service_charge_removed && (
                                  <span className="text-red-400">SC waived</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between pt-3 border-t-2 font-bold text-sm">
                        <span>Total ({summary.bills.length} bills)</span>
                        <span>₹{summary.totalSales.toFixed(0)}</span>
                      </div>
                    </div>

                    {/* Summary below table */}
                    <div className="mt-6 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">GST Collected</p>
                        <p className="font-bold text-base sm:text-lg">₹{summary.totalGST.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Service Charge</p>
                        <p className="font-bold text-base sm:text-lg">₹{summary.totalSC.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Discounts</p>
                        <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">SC Waived</p>
                        <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================== CAPTAIN PERFORMANCE =================== */}
          {activeTab === 'waiter_performance' && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-sm sm:text-base font-semibold">Captain Performance</h3>
                  <Button variant="outline" size="sm" onClick={exportWaiterCSV} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </Button>
                </div>
                <div className="p-4">
                  {summary.waiterStats.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No captain data for this period</p>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2.5 font-medium w-10">#</th>
                              <th className="pb-2.5 font-medium">Captain</th>
                              <th className="pb-2.5 font-medium">Role</th>
                              <th className="pb-2.5 font-medium text-right">Orders</th>
                              <th className="pb-2.5 font-medium text-right">Revenue</th>
                              <th className="pb-2.5 font-medium text-right">Avg Order</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.waiterStats.map((w, i) => (
                              <tr key={w.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                                <td className="py-2.5 font-medium">{w.name}</td>
                                <td className="py-2.5">
                                  <Badge variant="outline" className="text-xs capitalize">{w.role}</Badge>
                                </td>
                                <td className="py-2.5 text-right">{w.orders}</td>
                                <td className="py-2.5 text-right font-semibold">₹{w.revenue.toFixed(0)}</td>
                                <td className="py-2.5 text-right text-muted-foreground">₹{w.avgOrderValue.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-bold">
                              <td className="pt-3" colSpan={3}>Total</td>
                              <td className="pt-3 text-right">{summary.waiterStats.reduce((s, w) => s + w.orders, 0)}</td>
                              <td className="pt-3 text-right">₹{summary.waiterStats.reduce((s, w) => s + w.revenue, 0).toFixed(0)}</td>
                              <td className="pt-3 text-right">₹{summary.avgOrderValue.toFixed(0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Mobile card list */}
                      <div className="sm:hidden space-y-2">
                        {summary.waiterStats.map((w, i) => (
                          <div key={w.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold shrink-0">
                                {w.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{w.name}</p>
                                <p className="text-xs text-muted-foreground">{w.orders} orders · Avg ₹{w.avgOrderValue.toFixed(0)}</p>
                              </div>
                            </div>
                            <span className="text-sm font-bold">₹{w.revenue.toFixed(0)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-3 border-t-2 font-bold text-sm">
                          <span>Total ({summary.waiterStats.reduce((s, w) => s + w.orders, 0)} orders)</span>
                          <span>₹{summary.waiterStats.reduce((s, w) => s + w.revenue, 0).toFixed(0)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Revenue share bars */}
              {summary.waiterStats.length > 0 && (
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Revenue Share</h3>
                  <div className="space-y-3">
                    {summary.waiterStats.map(w => {
                      const maxRev = summary.waiterStats[0]?.revenue || 1
                      const pct = (w.revenue / maxRev) * 100
                      return (
                        <div key={w.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{w.name}</span>
                            <span className="text-muted-foreground text-xs sm:text-sm">
                              {w.orders} orders · ₹{w.revenue.toFixed(0)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================== PAYMENT BREAKDOWN =================== */}
          {activeTab === 'payment_breakdown' && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                {summary.totalSales === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No payments for this period</p>
                ) : (
                  <>
                    {/* Payment mode cards */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="text-center p-3 sm:p-4 bg-green-50 rounded-xl border border-green-100">
                        <Banknote className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-green-600 mb-1.5" />
                        <p className="text-xs text-muted-foreground">Cash</p>
                        <p className="text-base sm:text-xl font-bold text-green-700">₹{summary.cashTotal.toFixed(0)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {summary.cashCount} txns · {summary.totalSales > 0 ? ((summary.cashTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-blue-600 mb-1.5" />
                        <p className="text-xs text-muted-foreground">UPI</p>
                        <p className="text-base sm:text-xl font-bold text-blue-700">₹{summary.upiTotal.toFixed(0)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {summary.upiCount} txns · {summary.totalSales > 0 ? ((summary.upiTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-purple-600 mb-1.5" />
                        <p className="text-xs text-muted-foreground">Card</p>
                        <p className="text-base sm:text-xl font-bold text-purple-700">₹{summary.cardTotal.toFixed(0)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {summary.cardCount} txns · {summary.totalSales > 0 ? ((summary.cardTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                    </div>

                    {/* Visual bar */}
                    <div className="h-5 sm:h-6 rounded-full overflow-hidden flex bg-muted">
                      {summary.cashTotal > 0 && (
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${(summary.cashTotal / summary.totalSales) * 100}%` }}
                        />
                      )}
                      {summary.upiTotal > 0 && (
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${(summary.upiTotal / summary.totalSales) * 100}%` }}
                        />
                      )}
                      {summary.cardTotal > 0 && (
                        <div
                          className="bg-purple-500 h-full transition-all"
                          style={{ width: `${(summary.cardTotal / summary.totalSales) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Cash</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> UPI</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Card</span>
                    </div>

                    {/* Tax & charges */}
                    <div className="mt-6 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">GST</p>
                        <p className="font-bold text-base sm:text-lg">₹{summary.totalGST.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Service Charge</p>
                        <p className="font-bold text-base sm:text-lg">₹{summary.totalSC.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Discounts</p>
                        <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">SC Waived</p>
                        <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================== SETTLEMENT =================== */}
          {activeTab === 'settlement' && (
            <div className="space-y-4">
              {/* Payment Mode Summary */}
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-sm sm:text-base font-semibold">Payment Mode Summary</h3>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                    if (!summary) return
                    const headers = ['Mode', 'Count', 'Amount', '% Share']
                    const total = summary.cashTotal + summary.upiTotal + summary.cardTotal
                    const rows = [
                      ['Cash', summary.cashCount, summary.cashTotal.toFixed(2), total > 0 ? ((summary.cashTotal / total) * 100).toFixed(1) + '%' : '0%'],
                      ['UPI', summary.upiCount, summary.upiTotal.toFixed(2), total > 0 ? ((summary.upiTotal / total) * 100).toFixed(1) + '%' : '0%'],
                      ['Card', summary.cardCount, summary.cardTotal.toFixed(2), total > 0 ? ((summary.cardTotal / total) * 100).toFixed(1) + '%' : '0%'],
                      ['Total', summary.cashCount + summary.upiCount + summary.cardCount, total.toFixed(2), '100%'],
                    ]
                    downloadCSV(`settlement-${dateSuffix}.csv`, headers, rows as any)
                  }}>
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                </div>
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2.5 font-medium">Mode</th>
                        <th className="pb-2.5 font-medium text-right">Txns</th>
                        <th className="pb-2.5 font-medium text-right">Amount</th>
                        <th className="pb-2.5 font-medium text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { mode: 'Cash', count: summary.cashCount, total: summary.cashTotal, color: 'text-green-700', dot: 'bg-green-500' },
                        { mode: 'UPI', count: summary.upiCount, total: summary.upiTotal, color: 'text-blue-700', dot: 'bg-blue-500' },
                        { mode: 'Card', count: summary.cardCount, total: summary.cardTotal, color: 'text-purple-700', dot: 'bg-purple-500' },
                      ].map(row => {
                        const allTotal = summary.cashTotal + summary.upiTotal + summary.cardTotal
                        return (
                          <tr key={row.mode} className="border-b last:border-0">
                            <td className="py-2.5 font-medium">
                              <span className="flex items-center gap-2">
                                <span className={cn('h-2.5 w-2.5 rounded-full', row.dot)} />
                                <span className={row.color}>{row.mode}</span>
                              </span>
                            </td>
                            <td className="py-2.5 text-right">{row.count}</td>
                            <td className="py-2.5 text-right font-semibold">₹{row.total.toFixed(0)}</td>
                            <td className="py-2.5 text-right text-muted-foreground">
                              {allTotal > 0 ? ((row.total / allTotal) * 100).toFixed(0) : 0}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="pt-3">Total</td>
                        <td className="pt-3 text-right">{summary.cashCount + summary.upiCount + summary.cardCount}</td>
                        <td className="pt-3 text-right">₹{(summary.cashTotal + summary.upiTotal + summary.cardTotal).toFixed(0)}</td>
                        <td className="pt-3 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Hourly Sales */}
              {summary.hourlySales.length > 0 && (
                <div className="rounded-xl border bg-card">
                  <div className="p-4 border-b">
                    <h3 className="text-sm sm:text-base font-semibold">Hourly Sales</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {summary.hourlySales.map(h => {
                      const maxTotal = Math.max(...summary.hourlySales.map(x => x.total))
                      const pct = maxTotal > 0 ? (h.total / maxTotal) * 100 : 0
                      const label = `${h.hour.toString().padStart(2, '0')}:00`
                      return (
                        <div key={h.hour} className="flex items-center gap-2 sm:gap-3 text-sm">
                          <span className="w-12 sm:w-14 text-muted-foreground text-xs shrink-0">{label}</span>
                          <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                          <span className="w-24 sm:w-32 text-right text-xs shrink-0">
                            {h.count} bills · ₹{h.total.toFixed(0)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tax & Charges */}
              <div className="rounded-xl border bg-card">
                <div className="p-4 border-b">
                  <h3 className="text-sm sm:text-base font-semibold">Tax &amp; Charges</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">GST Collected</p>
                    <p className="font-bold text-base sm:text-lg">₹{summary.totalGST.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Service Charge</p>
                    <p className="font-bold text-base sm:text-lg">₹{summary.totalSC.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Discounts</p>
                    <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">SC Waived</p>
                    <p className="font-bold text-base sm:text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                  </div>
                </div>
              </div>

              {/* Refunds & Outstanding side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={cn('rounded-xl border bg-card', summary.refundSummary.count > 0 && 'border-orange-200')}>
                  <div className="p-4 border-b">
                    <h3 className="text-sm sm:text-base font-semibold">Refunds</h3>
                  </div>
                  <div className="p-4">
                    {summary.refundSummary.count === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">No refunds</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-sm">Total Refunds</span>
                          <span className="text-lg sm:text-xl font-bold text-orange-600">₹{summary.refundSummary.total.toFixed(0)}</span>
                        </div>
                        <div className="text-sm space-y-1.5">
                          {summary.refundSummary.byMode.map(m => (
                            <div key={m.mode} className="flex justify-between">
                              <span className="text-muted-foreground capitalize">{m.mode} ({m.count})</span>
                              <span className="font-medium">₹{m.total.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={cn('rounded-xl border bg-card', summary.outstandingSummary.count > 0 && 'border-amber-200')}>
                  <div className="p-4 border-b">
                    <h3 className="text-sm sm:text-base font-semibold">Outstanding / Partial</h3>
                  </div>
                  <div className="p-4">
                    {summary.outstandingSummary.count === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">No outstanding bills</p>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">{summary.outstandingSummary.count} partial bill(s)</span>
                        <span className="text-lg sm:text-xl font-bold text-amber-700">₹{summary.outstandingSummary.total.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
