'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bill, Payment, Profile } from '@/types/database'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GST_PERCENT, SERVICE_CHARGE_PERCENT } from '@/lib/constants'
import { getBusinessDayRange, getCurrentBusinessDate, loadDayBoundaryHour } from '@/lib/utils/business-day'
import {
  IndianRupee,
  TrendingUp,
  Receipt,
  Percent,
  Grid3X3,
  HandCoins,
  XCircle,
  Banknote,
  Smartphone,
  CreditCard,
  Users,
  Store,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowDownRight,
  Utensils,
  Coffee,
  Flame,
  Trophy,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'

interface DashboardData {
  totalSales: number
  netSales: number
  taxes: number
  discounts: number
  tablesServed: number
  scCollected: number
  scDeleted: number
  totalOrders: number
  cashTotal: number
  upiTotal: number
  cardTotal: number
  zomatoTotal: number
  ncTotal: number
  runningEstSales: number
  runningTables: number
  totalTables: number
  mealPeriodSales: { name: string; sales: number; orders: number }[]
  weeklySales: { day: string; date: string; sales: number; orders: number }[]
  scByStaff: { name: string; amount: number; count: number }[]
}

const MEAL_PERIODS = [
  { name: 'Breakfast', start: 6, end: 12, color: '#f59e0b' },
  { name: 'Lunch', start: 12, end: 16, color: '#ef4444' },
  { name: 'Evening', start: 16, end: 20, color: '#8b5cf6' },
  { name: 'Dinner', start: 20, end: 6, color: '#3b82f6' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminDashboard() {
  const { profile } = useAuth(['admin', 'manager', 'accountant'])
  const [boundaryHour, setBoundaryHour] = useState(3)
  const [selectedDate, setSelectedDate] = useState(() => getCurrentBusinessDate(3))
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryPerf, setCategoryPerf] = useState<{ name: string; total: number }[]>([])
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Load boundary hour setting
    const bh = await loadDayBoundaryHour(supabase)
    setBoundaryHour(bh)

    const { start: startOfDay, end: endOfDay } = getBusinessDayRange(selectedDate, bh)

    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const selDate = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = selDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(selDate)
    weekStart.setDate(selDate.getDate() + mondayOffset)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const weekStartStr = fmtDate(weekStart)
    const weekEndStr = fmtDate(weekEnd)
    const weekStartUTC = getBusinessDayRange(weekStartStr, bh).start
    const weekEndUTC = getBusinessDayRange(weekEndStr, bh).end

    const [billsResult, weeklyBillsResult, tablesResult, runningOrdersResult, allTablesResult] = await Promise.all([
      supabase
        .from('bills')
        .select('*, payments(*), order:orders!order_id(waiter_id, waiter:profiles!waiter_id(name))')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      supabase
        .from('bills')
        .select('created_at, total')
        .gte('created_at', weekStartUTC)
        .lte('created_at', weekEndUTC)
        .eq('payment_status', 'paid'),
      supabase
        .from('orders')
        .select('table_id')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .not('table_id', 'is', null)
        .eq('status', 'completed'),
      // Running order items (live - for estimated running sales)
      supabase
        .from('order_items')
        .select('total_price, is_cancelled, order:orders!order_id(status)')
        .in('order.status', ['pending', 'preparing', 'ready', 'served']),
      // All tables with status
      supabase
        .from('tables')
        .select('id, status'),
    ])

    const bills = (billsResult.data || []) as (Bill & { payments?: Payment[]; order?: { waiter_id: string | null; waiter: { name: string } | null } })[]
    const weeklyBills = weeklyBillsResult.data || []

    let totalSales = 0
    let taxes = 0
    let discounts = 0
    let scCollected = 0
    let scDeleted = 0
    let cashTotal = 0
    let upiTotal = 0
    let cardTotal = 0
    let zomatoTotal = 0
    let ncTotal = 0

    const scStaffMap = new Map<string, { name: string; amount: number; count: number }>()
    const mealMap = new Map<string, { sales: number; orders: number }>()
    MEAL_PERIODS.forEach(p => mealMap.set(p.name, { sales: 0, orders: 0 }))

    bills.forEach(bill => {
      const total = Number(bill.total)
      const gst = Number(bill.gst_amount)
      const disc = Number(bill.discount_amount)
      const sc = Number(bill.service_charge)

      totalSales += total
      taxes += gst
      discounts += disc

      if (bill.service_charge_removed) {
        scDeleted += sc
        const waiterName = bill.order?.waiter?.name || 'Unknown'
        const waiterId = bill.order?.waiter_id || 'unknown'
        const existing = scStaffMap.get(waiterId)
        if (existing) {
          existing.amount += sc
          existing.count += 1
        } else {
          scStaffMap.set(waiterId, { name: waiterName, amount: sc, count: 1 })
        }
      } else {
        scCollected += sc
      }

      if (bill.payments) {
        bill.payments.forEach((p: Payment) => {
          switch (p.mode) {
            case 'cash': cashTotal += Number(p.amount); break
            case 'upi': upiTotal += Number(p.amount); break
            case 'card': cardTotal += Number(p.amount); break
            case 'zomato': zomatoTotal += Number(p.amount); break
            case 'nc': ncTotal += Number(p.amount); break
          }
        })
      }

      const hour = new Date(bill.created_at).getHours()
      for (const period of MEAL_PERIODS) {
        const matches = period.start < period.end
          ? hour >= period.start && hour < period.end
          : hour >= period.start || hour < period.end
        if (matches) {
          const entry = mealMap.get(period.name)!
          entry.sales += total
          entry.orders += 1
          break
        }
      }
    })

    const netSales = totalSales - taxes - scCollected

    const uniqueTables = new Set(
      (tablesResult.data || []).map((o: any) => o.table_id).filter(Boolean)
    )

    const weekDayMap = new Map<string, { sales: number; orders: number }>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      weekDayMap.set(fmtDate(d), { sales: 0, orders: 0 })
    }

    weeklyBills.forEach((bill: any) => {
      const d = new Date(bill.created_at)
      const dateStr = fmtDate(d)
      const entry = weekDayMap.get(dateStr)
      if (entry) {
        entry.sales += Number(bill.total)
        entry.orders += 1
      }
    })

    const weeklySales = Array.from(weekDayMap.entries()).map(([dateStr, val]) => {
      const d = new Date(dateStr + 'T12:00:00')
      return { day: DAY_NAMES[d.getDay()], date: dateStr, sales: val.sales, orders: val.orders }
    })

    const mealPeriodSales = MEAL_PERIODS.map(p => ({
      name: p.name,
      sales: mealMap.get(p.name)!.sales,
      orders: mealMap.get(p.name)!.orders,
    }))

    const scByStaff = Array.from(scStaffMap.values()).sort((a, b) => b.amount - a.amount)

    const allTablesList = allTablesResult.data || []
    const runningItemsRaw = runningOrdersResult.data || []
    // Sum active (non-cancelled) items from running orders, then apply GST + SC
    const runningSubtotal = runningItemsRaw
      .filter((r: any) => r.order && !r.is_cancelled)
      .reduce((s: number, r: any) => s + Number(r.total_price), 0)
    const runningEstSales = Math.round(runningSubtotal * (1 + GST_PERCENT / 100 + SERVICE_CHARGE_PERCENT / 100))
    const runningTables = allTablesList.filter((t: any) => t.status === 'occupied').length
    const totalTables = allTablesList.length

    setData({
      totalSales, netSales, taxes, discounts,
      tablesServed: uniqueTables.size,
      scCollected, scDeleted, totalOrders: bills.length,
      cashTotal, upiTotal, cardTotal, zomatoTotal, ncTotal,
      runningEstSales, runningTables, totalTables,
      mealPeriodSales, weeklySales, scByStaff,
    })

    // Category Performance
    const { data: categoryRows } = await supabase
      .from('order_items')
      .select(`
        total_price,
        menu_item:menu_items!menu_item_id(category:categories!category_id(name)),
        order:orders!order_id(bill:bills!inner(payment_status, created_at))
      `)
      .eq('order.bill.payment_status', 'paid')
      .gte('order.bill.created_at', startOfDay)
      .lte('order.bill.created_at', endOfDay)

    const catMap = new Map<string, number>()
    if (categoryRows) {
      for (const row of categoryRows as any[]) {
        const billData = row.order?.bill
        if (!billData) continue
        const billArr = Array.isArray(billData) ? billData : [billData]
        const validBill = billArr.find(
          (b: any) => b.payment_status === 'paid' && b.created_at >= startOfDay && b.created_at <= endOfDay
        )
        if (!validBill) continue
        const catName: string = row.menu_item?.category?.name ?? 'Uncategorised'
        catMap.set(catName, (catMap.get(catName) ?? 0) + Number(row.total_price))
      }
    }
    setCategoryPerf(
      Array.from(catMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    )

    // Top 10 Items
    const { data: itemRows } = await supabase
      .from('order_items')
      .select(`
        quantity,
        menu_item:menu_items!menu_item_id(name),
        order:orders!order_id(bill:bills!inner(payment_status, created_at))
      `)
      .eq('order.bill.payment_status', 'paid')
      .gte('order.bill.created_at', startOfDay)
      .lte('order.bill.created_at', endOfDay)

    const itemMap = new Map<string, number>()
    if (itemRows) {
      for (const row of itemRows as any[]) {
        const billData = row.order?.bill
        if (!billData) continue
        const billArr = Array.isArray(billData) ? billData : [billData]
        const validBill = billArr.find(
          (b: any) => b.payment_status === 'paid' && b.created_at >= startOfDay && b.created_at <= endOfDay
        )
        if (!validBill) continue
        const itemName: string = row.menu_item?.name ?? 'Unknown'
        itemMap.set(itemName, (itemMap.get(itemName) ?? 0) + Number(row.quantity))
      }
    }
    setTopItems(
      Array.from(itemMap.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10)
    )

    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Date navigation helpers
  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + dir)
    const f = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    setSelectedDate(f(d))
  }

  const todayStr = getCurrentBusinessDate(boundaryHour)

  const isToday = selectedDate === todayStr
  const displayDate = new Date(selectedDate + 'T12:00:00')

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const MEAL_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

  // Payment modes for breakdown
  const paymentModes = data ? [
    { label: 'Cash', amount: data.cashTotal, color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700', icon: Banknote },
    { label: 'UPI', amount: data.upiTotal, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-700', icon: Smartphone },
    { label: 'Card', amount: data.cardTotal, color: 'bg-violet-500', light: 'bg-violet-50 text-violet-700', icon: CreditCard },
    { label: 'Zomato', amount: data.zomatoTotal, color: 'bg-red-500', light: 'bg-red-50 text-red-700', icon: Store },
    ...(data.ncTotal > 0 ? [{ label: 'NC', amount: data.ncTotal, color: 'bg-gray-400', light: 'bg-gray-50 text-gray-600', icon: Percent }] : []),
  ].filter(m => m.amount > 0) : []

  const paymentTotal = paymentModes.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-5">
        {/* Greeting */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isToday ? 'Today\u2019s Overview' : displayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </h1>
            {isToday && (
              <p className="text-sm text-gray-500 mt-0.5">
                {displayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={loadDashboard} className="text-gray-400">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-1.5 shadow-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center gap-1.5 justify-center overflow-x-auto">
            {!isToday && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 shrink-0"
                onClick={() => setSelectedDate(todayStr)}
              >
                Today
              </Button>
            )}
            <div className="relative shrink-0">
              <Input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="h-8 w-[140px] text-sm border-0 bg-transparent text-center font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigateDate(1)}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-200 border-t-amber-600" />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      ) : data ? (
        <div className="space-y-4">

          {/* ── Hero Card: Total Sales ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 p-5 text-white shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-200 text-sm font-medium">Total Sales</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{fmt(data.totalSales)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                  <IndianRupee className="h-6 w-6" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/15">
                <div>
                  <p className="text-[11px] text-amber-200/80 uppercase tracking-wider">Bills Settled</p>
                  <p className="text-lg font-semibold">{data.totalOrders}</p>
                </div>
                <div className="w-px h-8 bg-white/15" />
                <div>
                  <p className="text-[11px] text-amber-200/80 uppercase tracking-wider">Avg/Bill</p>
                  <p className="text-lg font-semibold">{data.totalOrders > 0 ? fmt(Math.round(data.totalSales / data.totalOrders)) : '₹0'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Live Status: Running Orders & Tables ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Est. Running Sales */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 p-4 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-200 text-xs font-medium">Est. Running Sales</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold tracking-tight">{fmt(data.runningEstSales)}</p>
                <p className="text-[11px] text-blue-200/70 mt-1">Active orders value</p>
              </div>
            </div>

            {/* Running Tables */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 p-4 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-emerald-200 text-xs font-medium">Running Tables</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <Grid3X3 className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">{data.runningTables}</p>
                <p className="text-[11px] text-emerald-200/70 mt-1">Tables occupied</p>
              </div>
            </div>
          </div>

          {/* ── Quick Stats Grid ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Net Sales */}
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Net Sales</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{fmt(data.netSales)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Excl. tax & service charge</p>
            </div>

            {/* GST */}
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
                  <Receipt className="h-3.5 w-3.5 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">GST (5%)</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{fmt(data.taxes)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Tax collected</p>
            </div>

            {/* Service Charge */}
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <HandCoins className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">SC Collected</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{fmt(data.scCollected)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Service charge</p>
            </div>

            {/* SC Deleted */}
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                </div>
                <span className="text-xs font-medium text-gray-500">SC Deleted</span>
              </div>
              <p className="text-xl font-bold text-red-600">{fmt(data.scDeleted)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Service charge waived</p>
            </div>
          </div>

          {/* ── Discounts ── */}
          <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
                  <Percent className="h-3.5 w-3.5 text-rose-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Discounts</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{fmt(data.discounts)}</p>
            </div>
          </div>

          {/* ── Payment Breakdown ── */}
          {paymentModes.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Breakdown</h3>

              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-4">
                {paymentModes.map((m) => (
                  <div
                    key={m.label}
                    className={`${m.color} transition-all duration-500`}
                    style={{ width: `${paymentTotal > 0 ? (m.amount / paymentTotal * 100) : 0}%` }}
                  />
                ))}
              </div>

              {/* Payment items */}
              <div className="space-y-2.5">
                {paymentModes.map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.light}`}>
                      <m.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{m.label}</span>
                        <span className="text-sm font-bold text-gray-900">{fmt(m.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 mr-3">
                          <div
                            className={`h-full rounded-full ${m.color} transition-all duration-500`}
                            style={{ width: `${paymentTotal > 0 ? (m.amount / paymentTotal * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums">
                          {paymentTotal > 0 ? Math.round(m.amount / paymentTotal * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SC Waived by Staff ── */}
          {data.scByStaff.length > 0 && (
            <div className="rounded-2xl bg-white border border-red-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                  <Users className="h-3.5 w-3.5 text-red-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">SC Waived by Staff</h3>
                <span className="ml-auto text-xs font-bold text-red-500">{fmt(data.scDeleted)}</span>
              </div>
              <div className="space-y-2">
                {data.scByStaff.map((staff) => (
                  <div key={staff.name} className="flex items-center gap-3 py-2 px-3 bg-red-50/50 rounded-xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                      {staff.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{staff.name}</p>
                      <p className="text-[11px] text-gray-400">{staff.count} table{staff.count > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">{fmt(staff.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Meal Period Sales ── */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Utensils className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Sales by Meal Period</h3>
            </div>

            {/* Mobile-friendly meal cards instead of chart on small screens */}
            <div className="grid grid-cols-2 gap-2 mb-4 sm:hidden">
              {data.mealPeriodSales.map((period, i) => (
                <div key={period.name} className="rounded-xl p-3" style={{ backgroundColor: MEAL_COLORS[i] + '12' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MEAL_COLORS[i] }} />
                    <span className="text-xs font-medium text-gray-600">{period.name}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{fmt(period.sales)}</p>
                  <p className="text-[11px] text-gray-400">{period.orders} orders</p>
                </div>
              ))}
            </div>

            {/* Chart for larger screens */}
            <div className="hidden sm:block h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mealPeriodSales} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                    contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="sales" radius={[8, 8, 0, 0]} maxBarSize={60}>
                    {data.mealPeriodSales.map((_, index) => (
                      <Cell key={index} fill={MEAL_COLORS[index]} />
                    ))}
                    <LabelList
                      dataKey="sales"
                      position="top"
                      formatter={(v) => Number(v) > 0 ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend (larger screens) */}
            <div className="hidden sm:flex justify-center gap-4 mt-2">
              {data.mealPeriodSales.map((period, i) => (
                <div key={period.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MEAL_COLORS[i] }} />
                  {period.name} ({period.orders})
                </div>
              ))}
            </div>
          </div>

          {/* ── Weekly Sales ── */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                  <Flame className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Weekly Sales</h3>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(data.weeklySales[0]?.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(data.weeklySales[6]?.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Mobile: horizontal bar list */}
            <div className="space-y-2 sm:hidden">
              {data.weeklySales.map((entry) => {
                const maxSales = Math.max(...data.weeklySales.map(d => d.sales), 1)
                const isSel = entry.date === selectedDate
                return (
                  <div key={entry.date} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isSel ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}>
                    <div className="w-10 text-xs font-medium text-gray-500">{entry.day}</div>
                    <div className="flex-1">
                      <div className="h-5 rounded-md bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all duration-500 ${isSel ? 'bg-amber-600' : 'bg-amber-300'}`}
                          style={{ width: `${(entry.sales / maxSales) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right w-16">
                      <p className={`text-xs font-bold ${isSel ? 'text-amber-700' : 'text-gray-700'}`}>{fmt(entry.sales)}</p>
                      <p className="text-[10px] text-gray-400">{entry.orders} ord</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: chart */}
            <div className="hidden sm:block h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklySales} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload
                      if (item?.date) return new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
                      return label
                    }}
                    contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="sales" fill="#d97706" radius={[8, 8, 0, 0]} maxBarSize={50}>
                    {data.weeklySales.map((entry) => (
                      <Cell key={entry.date} fill={entry.date === selectedDate ? '#b45309' : '#fbbf24'} />
                    ))}
                    <LabelList
                      dataKey="sales"
                      position="top"
                      formatter={(v) => Number(v) > 0 ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''}
                      style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Week total */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm">
              <span className="text-gray-500">Week Total</span>
              <span className="font-bold text-gray-900">
                {fmt(data.weeklySales.reduce((sum, d) => sum + d.sales, 0))}
                <span className="text-gray-400 font-normal ml-1.5">
                  ({data.weeklySales.reduce((sum, d) => sum + d.orders, 0)} orders)
                </span>
              </span>
            </div>
          </div>

          {/* ── Category Performance ── */}
          {categoryPerf.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                  <Coffee className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Category Performance</h3>
              </div>

              {/* Mobile: list view */}
              <div className="space-y-2 sm:hidden">
                {categoryPerf.map((cat, i) => {
                  const maxTotal = categoryPerf[0]?.total || 1
                  return (
                    <div key={cat.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-medium text-gray-400 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                          <span className="text-sm font-bold text-gray-900 ml-2">{fmt(cat.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${(cat.total / maxTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: chart */}
              <div className="hidden sm:block" style={{ height: Math.max(200, categoryPerf.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryPerf} layout="vertical" margin={{ top: 5, right: 80, left: 8, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                      contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="total" fill="#d97706" radius={[0, 8, 8, 0]} maxBarSize={36}>
                      <LabelList
                        dataKey="total"
                        position="right"
                        formatter={(v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Top 10 Items ── */}
          {topItems.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <Trophy className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Top Items</h3>
                <span className="ml-auto text-xs text-gray-400">by quantity</span>
              </div>

              {/* Mobile: list view */}
              <div className="space-y-1.5 sm:hidden">
                {topItems.map((item, i) => {
                  const maxQty = topItems[0]?.qty || 1
                  return (
                    <div key={item.name} className="flex items-center gap-3 py-1.5">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-50 text-orange-600' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm text-gray-700 truncate">{item.name}</span>
                          <span className="text-sm font-bold text-gray-900 ml-2 tabular-nums">{item.qty}</span>
                        </div>
                        <div className="h-1 rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                            style={{ width: `${(item.qty / maxQty) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: chart */}
              <div className="hidden sm:block" style={{ height: Math.max(200, topItems.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ top: 5, right: 60, left: 8, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip
                      formatter={(value) => [Number(value), 'Qty']}
                      contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="qty" fill="#059669" radius={[0, 8, 8, 0]} maxBarSize={36}>
                      <LabelList dataKey="qty" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Bottom spacer for mobile */}
          <div className="h-4" />
        </div>
      ) : null}
    </div>
  )
}
