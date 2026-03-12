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
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  const [dateFrom, setDateFrom] = useState(() => formatDate(new Date()))
  const [dateTo, setDateTo] = useState(() => formatDate(new Date()))
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ReportTab>('item_sales')

  const isSingleDay = dateFrom === dateTo

  const loadReport = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const startOfDay = new Date(dateFrom + 'T00:00:00').toISOString()
    const endOfDay = new Date(dateTo + 'T23:59:59').toISOString()

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
    const headers = ['#', 'Bill Number', 'Order #', 'Table', 'Waiter', 'Time', 'Subtotal', 'GST', 'Service Charge', 'SC Removed', 'Discount', 'Net Sales', 'Total', 'Payment Mode', 'Ref #']
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
    const headers = ['#', 'Waiter', 'Role', 'Orders', 'Revenue', 'Avg Order Value']
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

  const tabs: { key: ReportTab; label: string; icon: typeof ClipboardList }[] = [
    { key: 'item_sales', label: 'Item Sales', icon: ClipboardList },
    { key: 'master_sales', label: 'Master Sales', icon: FileSpreadsheet },
    { key: 'waiter_performance', label: 'Waiter', icon: Users },
    { key: 'payment_breakdown', label: 'Payments', icon: PieChart },
    { key: 'settlement', label: 'Settlement', icon: BarChart3 },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isSingleDay && dateFrom === formatDate(new Date()) ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('today')}
          >
            Today
          </Button>
          <Button
            variant={(() => { const y = new Date(); y.setDate(y.getDate() - 1); return isSingleDay && dateFrom === formatDate(y) })() ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('yesterday')}
          >
            Yesterday
          </Button>
          <Button
            variant={!isSingleDay ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('last7')}
          >
            Last 7 Days
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value) }}
              className="w-36"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); if (e.target.value < dateFrom) setDateFrom(e.target.value) }}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">₹{summary.totalSales.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Net Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">₹{summary.netSales.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{summary.totalOrders}</p>
                <p className="text-xs text-gray-400 mt-1">Avg ₹{summary.avgOrderValue.toFixed(0)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {isSingleDay ? 'Date' : 'Period'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isSingleDay ? (
                  <p className="text-xl font-bold">{new Date(dateFrom + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                ) : (
                  <p className="text-base font-bold">
                    {new Date(dateFrom + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(dateTo + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Report Tabs */}
          <div className="flex items-center gap-1 border-b overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <Link href="/admin/eod">
                <Button size="sm" variant="outline">
                  <CalendarCheck className="h-4 w-4 mr-1" />
                  EOD
                </Button>
              </Link>
            )}
          </div>

          {/* Item Sales Report */}
          {activeTab === 'item_sales' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Item Sales Report</CardTitle>
                <Button variant="outline" size="sm" onClick={exportItemSalesCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent>
                {summary.itemSales.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No item sales for this period</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 font-medium w-10">#</th>
                            <th className="pb-2 font-medium">Item Name</th>
                            <th className="pb-2 font-medium">Category</th>
                            <th className="pb-2 font-medium text-right">Qty Sold</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.itemSales.map((item, i) => (
                            <tr key={item.name} className="border-b last:border-0">
                              <td className="py-2 text-gray-400">{i + 1}</td>
                              <td className="py-2 font-medium">{item.name}</td>
                              <td className="py-2 text-gray-500">{item.category}</td>
                              <td className="py-2 text-right">{item.quantity}</td>
                              <td className="py-2 text-right font-semibold">₹{item.revenue.toFixed(0)}</td>
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

                    {/* Category summary */}
                    {summary.categorySales.length > 0 && (
                      <div className="mt-6 pt-6 border-t">
                        <p className="text-sm font-medium text-gray-500 mb-3">By Category</p>
                        <div className="space-y-2">
                          {summary.categorySales.map(cat => {
                            const totalItemRev = summary.itemSales.reduce((s, i) => s + i.revenue, 0)
                            const pct = totalItemRev > 0 ? (cat.revenue / totalItemRev) * 100 : 0
                            return (
                              <div key={cat.name}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium">{cat.name}</span>
                                  <span className="text-gray-500">{cat.quantity} items &middot; ₹{cat.revenue.toFixed(0)} ({pct.toFixed(0)}%)</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-600 rounded-full"
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Master Sales Report */}
          {activeTab === 'master_sales' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Master Sales Report</CardTitle>
                <Button variant="outline" size="sm" onClick={exportMasterSalesCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent>
                {summary.bills.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No bills for this period</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 font-medium w-10">#</th>
                            <th className="pb-2 font-medium">Bill #</th>
                            <th className="pb-2 font-medium">Table</th>
                            <th className="pb-2 font-medium">Waiter</th>
                            <th className="pb-2 font-medium">Time</th>
                            <th className="pb-2 font-medium text-right">Subtotal</th>
                            <th className="pb-2 font-medium text-right">GST</th>
                            <th className="pb-2 font-medium text-right">SC</th>
                            <th className="pb-2 font-medium text-right">Discount</th>
                            <th className="pb-2 font-medium text-right">Total</th>
                            <th className="pb-2 font-medium">Payment</th>
                            <th className="pb-2 font-medium">Ref #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.bills.map((bill, i) => {
                            const tbl = bill.order?.table
                              ? getTableDisplayName(bill.order.table)
                              : bill.order?.order_type === 'takeaway' ? 'TA' : '-'
                            const sc = bill.service_charge_removed ? 0 : Number(bill.service_charge)
                            return (
                              <tr key={bill.id} className="border-b last:border-0">
                                <td className="py-2 text-gray-400">{i + 1}</td>
                                <td className="py-2 font-medium">{bill.bill_number}</td>
                                <td className="py-2">
                                  <Badge variant="outline" className="text-xs">{tbl}</Badge>
                                </td>
                                <td className="py-2 text-gray-500 text-xs">{bill.order?.waiter?.name || '-'}</td>
                                <td className="py-2 text-gray-500">
                                  {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2 text-right">₹{Number(bill.subtotal).toFixed(0)}</td>
                                <td className="py-2 text-right text-gray-500">₹{Number(bill.gst_amount).toFixed(0)}</td>
                                <td className="py-2 text-right text-gray-500">
                                  {bill.service_charge_removed ? (
                                    <span className="text-red-400 line-through">₹{Number(bill.service_charge).toFixed(0)}</span>
                                  ) : (
                                    `₹${sc.toFixed(0)}`
                                  )}
                                </td>
                                <td className="py-2 text-right text-gray-500">
                                  {Number(bill.discount_amount) > 0 ? `-₹${Number(bill.discount_amount).toFixed(0)}` : '-'}
                                </td>
                                <td className="py-2 text-right font-bold">₹{Number(bill.total).toFixed(0)}</td>
                                <td className="py-2">
                                  <Badge variant="outline" className="text-xs">
                                    {bill.payment_mode?.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="py-2 text-xs text-gray-400 max-w-[120px] truncate">
                                  {(bill.payments || [])
                                    .filter((p: Payment) => p.reference_number)
                                    .map((p: Payment) => p.reference_number)
                                    .join(', ') || '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-bold">
                            <td className="pt-3" colSpan={5}>Total ({summary.bills.length} bills)</td>
                            <td className="pt-3 text-right">₹{summary.bills.reduce((s, b) => s + Number(b.subtotal), 0).toFixed(0)}</td>
                            <td className="pt-3 text-right">₹{summary.totalGST.toFixed(0)}</td>
                            <td className="pt-3 text-right">₹{summary.totalSC.toFixed(0)}</td>
                            <td className="pt-3 text-right">{summary.totalDiscount > 0 ? `-₹${summary.totalDiscount.toFixed(0)}` : '-'}</td>
                            <td className="pt-3 text-right">₹{summary.totalSales.toFixed(0)}</td>
                            <td className="pt-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Summary below */}
                    <div className="mt-6 pt-6 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">GST Collected</p>
                        <p className="font-bold text-lg">₹{summary.totalGST.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Service Charge</p>
                        <p className="font-bold text-lg">₹{summary.totalSC.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Discounts</p>
                        <p className="font-bold text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">SC Waived</p>
                        <p className="font-bold text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Waiter Performance */}
          {activeTab === 'waiter_performance' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Waiter Performance</CardTitle>
                <Button variant="outline" size="sm" onClick={exportWaiterCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent>
                {summary.waiterStats.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No waiter data for this period</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 font-medium w-10">#</th>
                            <th className="pb-2 font-medium">Waiter</th>
                            <th className="pb-2 font-medium">Role</th>
                            <th className="pb-2 font-medium text-right">Orders</th>
                            <th className="pb-2 font-medium text-right">Revenue</th>
                            <th className="pb-2 font-medium text-right">Avg Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.waiterStats.map((w, i) => (
                            <tr key={w.id} className="border-b last:border-0">
                              <td className="py-2 text-gray-400">{i + 1}</td>
                              <td className="py-2 font-medium">{w.name}</td>
                              <td className="py-2">
                                <Badge variant="outline" className="text-xs capitalize">{w.role}</Badge>
                              </td>
                              <td className="py-2 text-right">{w.orders}</td>
                              <td className="py-2 text-right font-semibold">₹{w.revenue.toFixed(0)}</td>
                              <td className="py-2 text-right text-gray-500">₹{w.avgOrderValue.toFixed(0)}</td>
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

                    {/* Revenue share bars */}
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-medium text-gray-500 mb-3">Revenue Share</p>
                      <div className="space-y-2">
                        {summary.waiterStats.map(w => {
                          const maxRev = summary.waiterStats[0]?.revenue || 1
                          const pct = (w.revenue / maxRev) * 100
                          return (
                            <div key={w.id}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">{w.name}</span>
                                <span className="text-gray-500">{w.orders} orders &middot; ₹{w.revenue.toFixed(0)}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Breakdown */}
          {activeTab === 'payment_breakdown' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.totalSales === 0 ? (
                  <p className="text-center text-gray-400 py-8">No payments for this period</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <Banknote className="h-6 w-6 mx-auto text-green-600 mb-2" />
                        <p className="text-sm text-gray-500">Cash</p>
                        <p className="text-xl font-bold text-green-700">₹{summary.cashTotal.toFixed(0)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {summary.totalSales > 0 ? ((summary.cashTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <Smartphone className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                        <p className="text-sm text-gray-500">UPI</p>
                        <p className="text-xl font-bold text-blue-700">₹{summary.upiTotal.toFixed(0)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {summary.totalSales > 0 ? ((summary.upiTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <CreditCard className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                        <p className="text-sm text-gray-500">Card</p>
                        <p className="text-xl font-bold text-purple-700">₹{summary.cardTotal.toFixed(0)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {summary.totalSales > 0 ? ((summary.cardTotal / summary.totalSales) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                    </div>

                    {/* Visual bar */}
                    <div className="h-6 rounded-full overflow-hidden flex">
                      {summary.cashTotal > 0 && (
                        <div
                          className="bg-green-500 h-full"
                          style={{ width: `${(summary.cashTotal / summary.totalSales) * 100}%` }}
                          title={`Cash: ₹${summary.cashTotal.toFixed(0)}`}
                        />
                      )}
                      {summary.upiTotal > 0 && (
                        <div
                          className="bg-blue-500 h-full"
                          style={{ width: `${(summary.upiTotal / summary.totalSales) * 100}%` }}
                          title={`UPI: ₹${summary.upiTotal.toFixed(0)}`}
                        />
                      )}
                      {summary.cardTotal > 0 && (
                        <div
                          className="bg-purple-500 h-full"
                          style={{ width: `${(summary.cardTotal / summary.totalSales) * 100}%` }}
                          title={`Card: ₹${summary.cardTotal.toFixed(0)}`}
                        />
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Cash</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> UPI</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Card</span>
                    </div>

                    {/* Additional details */}
                    <div className="mt-6 pt-6 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">GST Collected</p>
                        <p className="font-bold text-lg">₹{summary.totalGST.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Service Charge</p>
                        <p className="font-bold text-lg">₹{summary.totalSC.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Discounts</p>
                        <p className="font-bold text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">SC Waived</p>
                        <p className="font-bold text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settlement Report */}
          {activeTab === 'settlement' && (
            <div className="space-y-4">
              {/* Payment Mode Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Payment Mode Summary</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => {
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
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Mode</th>
                        <th className="pb-2 font-medium text-right">Txns</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { mode: 'Cash', count: summary.cashCount, total: summary.cashTotal, color: 'text-green-700' },
                        { mode: 'UPI', count: summary.upiCount, total: summary.upiTotal, color: 'text-blue-700' },
                        { mode: 'Card', count: summary.cardCount, total: summary.cardTotal, color: 'text-purple-700' },
                      ].map(row => {
                        const allTotal = summary.cashTotal + summary.upiTotal + summary.cardTotal
                        return (
                          <tr key={row.mode} className="border-b last:border-0">
                            <td className={`py-2.5 font-medium ${row.color}`}>{row.mode}</td>
                            <td className="py-2.5 text-right">{row.count}</td>
                            <td className="py-2.5 text-right font-semibold">₹{row.total.toFixed(0)}</td>
                            <td className="py-2.5 text-right text-gray-500">
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
                </CardContent>
              </Card>

              {/* Hourly Sales */}
              {summary.hourlySales.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hourly Sales Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {summary.hourlySales.map(h => {
                        const maxTotal = Math.max(...summary.hourlySales.map(x => x.total))
                        const pct = maxTotal > 0 ? (h.total / maxTotal) * 100 : 0
                        const label = `${h.hour.toString().padStart(2, '0')}:00 - ${((h.hour + 1) % 24).toString().padStart(2, '0')}:00`
                        return (
                          <div key={h.hour} className="flex items-center gap-3 text-sm">
                            <span className="w-28 text-gray-500 text-xs">{label}</span>
                            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <span className="w-20 text-right text-xs">
                              {h.count} bills &middot; ₹{h.total.toFixed(0)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tax & Charges Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tax &amp; Charges</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">GST Collected</p>
                      <p className="font-bold text-lg">₹{summary.totalGST.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Service Charge</p>
                      <p className="font-bold text-lg">₹{summary.totalSC.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Discounts Given</p>
                      <p className="font-bold text-lg text-red-600">₹{summary.totalDiscount.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">SC Waived</p>
                      <p className="font-bold text-lg text-red-600">₹{summary.totalSCRemoved.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Refund Summary */}
              <Card className={summary.refundSummary.count > 0 ? 'border-orange-200' : ''}>
                <CardHeader>
                  <CardTitle className="text-base">Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.refundSummary.count === 0 ? (
                    <p className="text-center text-gray-400 py-4">No refunds in this period</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Total Refunds</span>
                        <span className="text-xl font-bold text-orange-600">₹{summary.refundSummary.total.toFixed(0)}</span>
                      </div>
                      <div className="text-sm space-y-1">
                        {summary.refundSummary.byMode.map(m => (
                          <div key={m.mode} className="flex justify-between">
                            <span className="text-gray-500 capitalize">{m.mode} ({m.count})</span>
                            <span>₹{m.total.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Outstanding / Partial */}
              <Card className={summary.outstandingSummary.count > 0 ? 'border-amber-200' : ''}>
                <CardHeader>
                  <CardTitle className="text-base">Outstanding / Partial Bills</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.outstandingSummary.count === 0 ? (
                    <p className="text-center text-gray-400 py-4">No outstanding bills</p>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-gray-500">{summary.outstandingSummary.count} partial bill(s)</span>
                      </div>
                      <span className="text-xl font-bold text-amber-700">₹{summary.outstandingSummary.total.toFixed(0)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
