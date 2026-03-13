'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table as TableType } from '@/types/database'
import { getTableDisplayName, groupTablesByDisplayGroup } from '@/lib/utils/table-display'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  RefreshCw,
  UtensilsCrossed,
  ShoppingBag,
  Users,
  Receipt,
  ChefHat,
} from 'lucide-react'

type ActiveTab = 'orders' | 'tables'

interface RunningOrder {
  id: string
  order_number: string
  order_type: 'dine_in' | 'takeaway'
  status: string
  created_at: string
  table: { number: number; section: string } | null
  waiter: { name: string } | null
  items: { quantity: number; total_price: number; is_cancelled: boolean; menu_item: { name: string } }[]
  bill: { id: string; bill_number: string; payment_status: string } | null
}

interface OrderSummary {
  dineIn: { count: number; amount: number }
  takeaway: { count: number; amount: number }
  total: { count: number; amount: number }
}

export default function RunningOrdersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tables')
  const [orders, setOrders] = useState<RunningOrder[]>([])
  const [tables, setTables] = useState<TableType[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  // Live timer — tick every 60s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    const supabase = createClient()

    // Get all active orders with details
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id, order_number, order_type, status, created_at,
        table:tables!table_id(number, section),
        waiter:profiles!waiter_id(name),
        items:order_items(quantity, total_price, is_cancelled, menu_item:menu_items(name)),
        bill:bills(id, bill_number, payment_status)
      `)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: true })

    // Get all tables
    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .order('section')
      .order('number')

    if (ordersData) {
      setOrders(ordersData.map((o: any) => ({
        ...o,
        bill: Array.isArray(o.bill) ? o.bill[0] || null : o.bill,
      })) as RunningOrder[])
    }
    if (tablesData) setTables(tablesData as TableType[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const debounceRef = { current: null as NodeJS.Timeout | null }

    const channel = supabase
      .channel('admin-running')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(loadData, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(loadData, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(loadData, 500)
      })
      .subscribe()

    const fallback = setInterval(loadData, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallback)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [loadData])

  // Compute summary
  const summary: OrderSummary = orders.reduce((acc, order) => {
    const activeItems = order.items.filter(i => !i.is_cancelled)
    const amount = activeItems.reduce((s, i) => s + Number(i.total_price), 0)
    acc.total.count++
    acc.total.amount += amount
    if (order.order_type === 'dine_in') {
      acc.dineIn.count++
      acc.dineIn.amount += amount
    } else {
      acc.takeaway.count++
      acc.takeaway.amount += amount
    }
    return acc
  }, {
    dineIn: { count: 0, amount: 0 },
    takeaway: { count: 0, amount: 0 },
    total: { count: 0, amount: 0 },
  })

  // Map orders to tables for Running Tables view
  const occupiedTables = tables.filter(t => t.status === 'occupied')
  const orderByTable = new Map<string, RunningOrder>()
  orders.forEach(o => {
    if (o.table) {
      // Find the table ID by matching number + section
      const matchingTable = tables.find(
        t => t.number === o.table!.number && t.section === o.table!.section
      )
      if (matchingTable) orderByTable.set(matchingTable.id, o)
    }
  })

  function formatElapsed(createdAt: string) {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (mins < 1) return '<1 Min'
    if (mins < 60) return `${mins} Mins`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-700" />
          Running Orders
        </h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'orders' as ActiveTab, label: 'Running Orders' },
          { key: 'tables' as ActiveTab, label: 'Running Tables' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── RUNNING ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Summary Cards — like Pet Pooja */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dine In */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-center space-y-2">
                <UtensilsCrossed className="h-6 w-6 mx-auto text-green-600" />
                <p className="text-gray-500 text-sm">Dine In</p>
                <p className="text-xs text-gray-400">Orders / KOTs</p>
                <p className="text-3xl font-bold">{summary.dineIn.count}</p>
                <p className="text-xs text-gray-400">Estimated Total Amount</p>
                <p className="text-xl font-bold">₹{summary.dineIn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>

            {/* Takeaway */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 text-center space-y-2">
                <ShoppingBag className="h-6 w-6 mx-auto text-blue-600" />
                <p className="text-gray-500 text-sm">Takeaway</p>
                <p className="text-xs text-gray-400">Orders</p>
                <p className="text-3xl font-bold">{summary.takeaway.count}</p>
                <p className="text-xs text-gray-400">Estimated Total Amount</p>
                <p className="text-xl font-bold">₹{summary.takeaway.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>

            {/* Total */}
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="p-6 text-center space-y-2">
                <Receipt className="h-6 w-6 mx-auto text-amber-700" />
                <p className="text-amber-800 text-sm font-medium">Total Running</p>
                <p className="text-xs text-amber-600">All Orders</p>
                <p className="text-3xl font-bold text-amber-900">{summary.total.count}</p>
                <p className="text-xs text-amber-600">Estimated Total Amount</p>
                <p className="text-xl font-bold text-amber-900">₹{summary.total.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Individual orders list */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">All Active Orders</h3>
            {orders.length === 0 ? (
              <p className="text-center text-gray-400 py-10">No running orders</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {orders.map(order => {
                  const activeItems = order.items.filter(i => !i.is_cancelled)
                  const amount = activeItems.reduce((s, i) => s + Number(i.total_price), 0)
                  const tableName = order.table ? getTableDisplayName(order.table) : null
                  const elapsed = formatElapsed(order.created_at)

                  return (
                    <Card key={order.id} className="border shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{order.order_number}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}</Badge>
                              <Badge className={`text-[10px] border-0 ${
                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                                order.status === 'ready' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{order.status}</Badge>
                            </div>
                            {tableName && <p className="text-xs text-gray-500 mt-0.5">Table {tableName}</p>}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            {elapsed}
                          </div>
                        </div>

                        {/* Items preview */}
                        <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                          {activeItems.map(i => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {order.waiter && (
                              <span className="flex items-center gap-1">
                                <ChefHat className="h-3.5 w-3.5" />
                                {order.waiter.name}
                              </span>
                            )}
                            {order.bill && (
                              <span className="flex items-center gap-1">
                                <Receipt className="h-3.5 w-3.5" />
                                {order.bill.bill_number}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-amber-800">₹{amount.toLocaleString('en-IN')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RUNNING TABLES TAB ── */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between bg-white rounded-xl border p-4">
            <div className="text-center">
              <p className="text-xs text-gray-400">Estimated Total</p>
              <p className="text-xl font-bold text-amber-800">₹{summary.total.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="h-8 border-l border-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-400">Total Running Tables</p>
              <p className="text-xl font-bold">{occupiedTables.length}</p>
            </div>
          </div>

          {/* Table cards — Pet Pooja style */}
          {occupiedTables.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No running tables</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {occupiedTables.map(table => {
                const order = orderByTable.get(table.id)
                if (!order) return null

                const activeItems = order.items.filter(i => !i.is_cancelled)
                const amount = activeItems.reduce((s, i) => s + Number(i.total_price), 0)
                const elapsed = formatElapsed(order.created_at)
                const kotCount = activeItems.length > 0 ? 1 : 0 // Simplified — count unique stations for KOTs
                const billInfo = order.bill

                return (
                  <Card key={table.id} className="border shadow-sm">
                    <CardContent className="p-0">
                      {/* Table header */}
                      <div className="flex items-center justify-between p-4 pb-3">
                        <span className="font-bold text-base">Table {getTableDisplayName(table)}</span>
                        <span className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          {elapsed}
                        </span>
                      </div>

                      {/* KOTs + Bill row */}
                      <div className="grid grid-cols-2 gap-px bg-gray-100 mx-4 rounded-lg overflow-hidden mb-3">
                        <div className="bg-white p-3 flex items-center gap-2">
                          <span className="text-gray-400 text-lg font-bold">#</span>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">KOTs</p>
                            <p className="font-bold text-sm">{order.order_number}</p>
                          </div>
                        </div>
                        <div className="bg-white p-3 flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Bill No.</p>
                            <p className="font-bold text-sm">{billInfo ? billInfo.bill_number : '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Captain */}
                      {order.waiter && (
                        <div className="flex items-center gap-2 px-4 pb-3">
                          <ChefHat className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Captain</p>
                            <p className="font-semibold text-sm">{order.waiter.name}</p>
                          </div>
                        </div>
                      )}

                      {/* Items preview */}
                      <div className="px-4 pb-3">
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {activeItems.map(i => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                        </p>
                      </div>

                      {/* Amount footer — green tint like Pet Pooja */}
                      <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-b-xl border-t border-green-100">
                        <span className="text-lg font-bold text-green-700">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <Badge className={`text-xs border-0 ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'ready' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{order.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
