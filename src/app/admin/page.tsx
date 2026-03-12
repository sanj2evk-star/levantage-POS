'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bill, Payment, Profile } from '@/types/database'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  mealPeriodSales: { name: string; sales: number; orders: number }[]
  weeklySales: { day: string; date: string; sales: number; orders: number }[]
  scByStaff: { name: string; amount: number; count: number }[]
}

const MEAL_PERIODS = [
  { name: 'Breakfast', start: 6, end: 12, color: '#f59e0b' },
  { name: 'Lunch', start: 12, end: 16, color: '#ef4444' },
  { name: 'Evening', start: 16, end: 20, color: '#8b5cf6' },
  { name: 'Dinner', start: 20, end: 6, color: '#3b82f6' }, // wraps around midnight
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminDashboard() {
  const { profile } = useAuth(['admin', 'manager', 'accountant'])
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryPerf, setCategoryPerf] = useState<{ name: string; total: number }[]>([])
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Convert local date to UTC range for Supabase queries
    // selectedDate is local (e.g., 2026-03-08 in IST)
    // We need to query Supabase with UTC timestamps that cover the local day
    const localStart = new Date(selectedDate + 'T00:00:00')
    const localEnd = new Date(selectedDate + 'T23:59:59')
    const startOfDay = localStart.toISOString()
    const endOfDay = localEnd.toISOString()

    // Helper to format date as YYYY-MM-DD in local time
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    // Get the week range (Mon-Sun containing selectedDate)
    const selDate = new Date(selectedDate + 'T12:00:00') // noon to avoid DST edge cases
    const dayOfWeek = selDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(selDate)
    weekStart.setDate(selDate.getDate() + mondayOffset)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const weekStartStr = fmtDate(weekStart)
    const weekEndStr = fmtDate(weekEnd)

    // Convert week boundaries to UTC for Supabase
    const weekStartUTC = new Date(weekStartStr + 'T00:00:00').toISOString()
    const weekEndUTC = new Date(weekEndStr + 'T23:59:59').toISOString()

    // Fetch today's bills + weekly bills in parallel
    const [billsResult, weeklyBillsResult, tablesResult] = await Promise.all([
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
    ])

    const bills = (billsResult.data || []) as (Bill & { payments?: Payment[]; order?: { waiter_id: string | null; waiter: { name: string } | null } })[]
    const weeklyBills = weeklyBillsResult.data || []

    // Compute stats from today's bills
    let totalSales = 0
    let taxes = 0
    let discounts = 0
    let scCollected = 0
    let scDeleted = 0
    let cashTotal = 0
    let upiTotal = 0
    let cardTotal = 0

    // SC by staff tracking
    const scStaffMap = new Map<string, { name: string; amount: number; count: number }>()

    // Meal period tracking
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
        scDeleted += sc // SC was removed, track how much was waived
        // Track which staff member's table this was
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

      // Payment breakdown
      if (bill.payments) {
        bill.payments.forEach((p: Payment) => {
          switch (p.mode) {
            case 'cash': cashTotal += Number(p.amount); break
            case 'upi': upiTotal += Number(p.amount); break
            case 'card': cardTotal += Number(p.amount); break
          }
        })
      }

      // Meal period
      const hour = new Date(bill.created_at).getHours()
      for (const period of MEAL_PERIODS) {
        const matches = period.start < period.end
          ? hour >= period.start && hour < period.end
          : hour >= period.start || hour < period.end // wraps midnight
        if (matches) {
          const entry = mealMap.get(period.name)!
          entry.sales += total
          entry.orders += 1
          break
        }
      }
    })

    const netSales = totalSales - taxes - discounts

    // Unique tables served
    const uniqueTables = new Set(
      (tablesResult.data || []).map((o: any) => o.table_id).filter(Boolean)
    )

    // Weekly sales
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
      const d = new Date(dateStr + 'T12:00:00') // noon to avoid timezone shift
      return {
        day: DAY_NAMES[d.getDay()],
        date: dateStr,
        sales: val.sales,
        orders: val.orders,
      }
    })

    const mealPeriodSales = MEAL_PERIODS.map(p => ({
      name: p.name,
      sales: mealMap.get(p.name)!.sales,
      orders: mealMap.get(p.name)!.orders,
    }))

    const scByStaff = Array.from(scStaffMap.values()).sort((a, b) => b.amount - a.amount)

    setData({
      totalSales,
      netSales,
      taxes,
      discounts,
      tablesServed: uniqueTables.size,
      scCollected,
      scDeleted,
      totalOrders: bills.length,
      cashTotal,
      upiTotal,
      cardTotal,
      mealPeriodSales,
      weeklySales,
      scByStaff,
    })

    // Category Performance: sales by category for selected date
    const { data: categoryRows } = await supabase
      .from('order_items')
      .select(`
        total_price,
        menu_item:menu_items!menu_item_id(
          category:categories!category_id(name)
        ),
        order:orders!order_id(
          bill:bills!inner(payment_status, created_at)
        )
      `)
      .eq('order.bill.payment_status', 'paid')
      .gte('order.bill.created_at', startOfDay)
      .lte('order.bill.created_at', endOfDay)

    const catMap = new Map<string, number>()
    if (categoryRows) {
      for (const row of categoryRows as any[]) {
        const billData = row.order?.bill
        if (!billData) continue
        // Handle array or object from inner join
        const billArr = Array.isArray(billData) ? billData : [billData]
        const validBill = billArr.find(
          (b: any) =>
            b.payment_status === 'paid' &&
            b.created_at >= startOfDay &&
            b.created_at <= endOfDay
        )
        if (!validBill) continue
        const catName: string = row.menu_item?.category?.name ?? 'Uncategorised'
        catMap.set(catName, (catMap.get(catName) ?? 0) + Number(row.total_price))
      }
    }
    const categoryPerfData = Array.from(catMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
    setCategoryPerf(categoryPerfData)

    // Top 10 Items: by quantity for selected date
    const { data: itemRows } = await supabase
      .from('order_items')
      .select(`
        quantity,
        menu_item:menu_items!menu_item_id(name),
        order:orders!order_id(
          bill:bills!inner(payment_status, created_at)
        )
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
          (b: any) =>
            b.payment_status === 'paid' &&
            b.created_at >= startOfDay &&
            b.created_at <= endOfDay
        )
        if (!validBill) continue
        const itemName: string = row.menu_item?.name ?? 'Unknown'
        itemMap.set(itemName, (itemMap.get(itemName) ?? 0) + Number(row.quantity))
      }
    }
    const topItemsData = Array.from(itemMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
    setTopItems(topItemsData)

    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const datePresets = (() => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return [
      { label: 'Today', value: f(today) },
      { label: 'Yesterday', value: f(yesterday) },
    ]
  })()

  const fmt = (n: number) => {
    if (n >= 100000) return `₹${(n / 1000).toFixed(1)}k`
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const MEAL_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

  return (
    <div>
      {/* Header with date selector */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          {datePresets.map(preset => (
            <Button
              key={preset.value}
              variant={selectedDate === preset.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Primary Stats - 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.totalSales)}</p>
                <p className="text-xs text-gray-400 mt-1">{data.totalOrders} orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Net Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.netSales)}</p>
                <p className="text-xs text-gray-400 mt-1">After tax & discounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-600" />
                  Taxes (GST)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.taxes)}</p>
                <p className="text-xs text-gray-400 mt-1">5% GST collected</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-red-600" />
                  Discounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.discounts)}</p>
                <p className="text-xs text-gray-400 mt-1">Total discounts given</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats - 3 cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-indigo-600" />
                  Tables Served
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{data.tablesServed}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-emerald-600" />
                  SC Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.scCollected)}</p>
                <p className="text-xs text-gray-400 mt-1">Service charge</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  SC Deleted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl lg:text-3xl font-bold">{fmt(data.scDeleted)}</p>
                <p className="text-xs text-gray-400 mt-1">Service charge waived</p>
              </CardContent>
            </Card>
          </div>

          {/* SC Deleted by Staff */}
          {data.scByStaff.length > 0 && (
            <Card className="border-red-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-red-500" />
                  SC Waived by Staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.scByStaff.map((staff) => (
                    <div key={staff.name} className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                          {staff.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{staff.name}</p>
                          <p className="text-xs text-gray-500">{staff.count} table{staff.count > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-red-600">{fmt(staff.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Banknote className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-gray-500">Cash</p>
                  <p className="text-xl font-bold text-green-700">{fmt(data.cashTotal)}</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Smartphone className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                  <p className="text-sm text-gray-500">UPI</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(data.upiTotal)}</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <CreditCard className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                  <p className="text-sm text-gray-500">Card</p>
                  <p className="text-xl font-bold text-purple-700">{fmt(data.cardTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Meal Period Sales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sales by Meal Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.mealPeriodSales}
                      margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                      />
                      <Tooltip
                        formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                        labelFormatter={(label) => label}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                      />
                      <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={60}>
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
                {/* Legend with order counts */}
                <div className="flex justify-center gap-4 mt-2">
                  {data.mealPeriodSales.map((period, i) => (
                    <div key={period.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MEAL_COLORS[i] }} />
                      {period.name} ({period.orders})
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Sales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Weekly Sales
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {new Date(data.weeklySales[0]?.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(data.weeklySales[6]?.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.weeklySales}
                      margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                      />
                      <Tooltip
                        formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload
                          if (item?.date) {
                            return new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
                          }
                          return label
                        }}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                      />
                      <Bar dataKey="sales" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {data.weeklySales.map((entry) => (
                          <Cell
                            key={entry.date}
                            fill={entry.date === selectedDate ? '#b45309' : '#fbbf24'}
                          />
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
                {/* Weekly total */}
                <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm">
                  <span className="text-gray-500">Week Total</span>
                  <span className="font-bold">
                    {fmt(data.weeklySales.reduce((sum, d) => sum + d.sales, 0))}
                    <span className="text-gray-400 font-normal ml-1.5">
                      ({data.weeklySales.reduce((sum, d) => sum + d.orders, 0)} orders)
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Performance */}
          {categoryPerf.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(200, categoryPerf.length * 48) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryPerf}
                      layout="vertical"
                      margin={{ top: 5, right: 80, left: 8, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                      />
                      <Tooltip
                        formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Sales']}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                      />
                      <Bar dataKey="total" fill="#d97706" radius={[0, 6, 6, 0]} maxBarSize={36}>
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
              </CardContent>
            </Card>
          )}

          {/* Top 10 Items */}
          {topItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top 10 Items by Quantity</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(200, topItems.length * 48) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topItems}
                      layout="vertical"
                      margin={{ top: 5, right: 60, left: 8, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={130}
                      />
                      <Tooltip
                        formatter={(value) => [Number(value), 'Qty']}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                      />
                      <Bar dataKey="qty" fill="#059669" radius={[0, 6, 6, 0]} maxBarSize={36}>
                        <LabelList
                          dataKey="qty"
                          position="right"
                          style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  )
}
