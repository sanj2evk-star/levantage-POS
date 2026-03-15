'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table as TableType } from '@/types/database'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react'

interface RunningTable {
  table: TableType
  order: {
    id: string
    order_number: string
    status: string
    created_at: string
    waiter: { name: string } | null
    items: { quantity: number; total_price: number; is_cancelled: boolean; menu_item: { name: string } }[]
  } | null
}

export default function RunningOrdersPage() {
  const [runningTables, setRunningTables] = useState<RunningTable[]>([])
  const [totalTables, setTotalTables] = useState(0)
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  // Live timer — tick every 60s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all tables
    const { data: tablesData } = await supabase
      .from('tables')
      .select('id, number, section, capacity, status, current_order_id')
      .order('section')
      .order('number')

    if (!tablesData) { setLoading(false); return }
    setTotalTables(tablesData.length)

    // Get occupied tables with their orders
    const occupied = tablesData.filter(t => t.status === 'occupied' && t.current_order_id)
    if (occupied.length === 0) {
      setRunningTables([])
      setLoading(false)
      return
    }

    const orderIds = occupied.map(t => t.current_order_id!)
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, created_at,
        waiter:profiles!waiter_id(name),
        items:order_items(quantity, total_price, is_cancelled, menu_item:menu_items(name))
      `)
      .in('id', orderIds)

    const orderMap = new Map<string, any>()
    ;(ordersData || []).forEach((o: any) => orderMap.set(o.id, o))

    const result: RunningTable[] = occupied.map(t => ({
      table: t as unknown as TableType,
      order: orderMap.get(t.current_order_id!) || null,
    }))

    // Sort by elapsed time (oldest first)
    result.sort((a, b) => {
      const aTime = a.order ? new Date(a.order.created_at).getTime() : Date.now()
      const bTime = b.order ? new Date(b.order.created_at).getTime() : Date.now()
      return aTime - bTime
    })

    setRunningTables(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    let debounce: NodeJS.Timeout | null = null

    const channel = supabase
      .channel('admin-running')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(loadData, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(loadData, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(loadData, 500)
      })
      .subscribe()

    const fallback = setInterval(loadData, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallback)
      if (debounce) clearTimeout(debounce)
    }
  }, [loadData])

  function formatElapsed(createdAt: string) {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (mins < 1) return '<1m'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  // Compute totals
  const totalAmount = runningTables.reduce((sum, rt) => {
    if (!rt.order) return sum
    const active = rt.order.items.filter(i => !i.is_cancelled)
    return sum + active.reduce((s, i) => s + Number(i.total_price), 0)
  }, 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-neutral-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-neutral-700 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-700" />
          Running Tables
        </h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 bg-white dark:bg-neutral-900 rounded-xl border dark:border-neutral-700 p-4">
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-neutral-500">Running / Total</p>
          <p className="text-2xl font-bold">
            <span className="text-amber-700">{runningTables.length}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-gray-500 dark:text-neutral-400">{totalTables}</span>
          </p>
        </div>
        <div className="h-10 border-l border-gray-200 dark:border-neutral-700" />
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-neutral-500">Est. Total Amount</p>
          <p className="text-2xl font-bold text-amber-800">₹{totalAmount.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Table cards */}
      {runningTables.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
          <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No running tables</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {runningTables.map(rt => {
            const { table, order } = rt
            if (!order) return null

            const activeItems = order.items.filter(i => !i.is_cancelled)
            const amount = activeItems.reduce((s, i) => s + Number(i.total_price), 0)
            const elapsed = formatElapsed(order.created_at)
            const itemCount = activeItems.reduce((s, i) => s + i.quantity, 0)

            return (
              <div
                key={table.id}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Table header row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{getTableDisplayName(table)}</span>
                    <Badge className={`text-[10px] capitalize border-0 ${
                      order.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700' :
                      order.status === 'preparing' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700' :
                      order.status === 'ready' ? 'bg-green-100 dark:bg-green-900/40 text-green-700' :
                      order.status === 'served' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700' :
                      'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300'
                    }`}>{order.status}</Badge>
                  </div>
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {elapsed}
                  </span>
                </div>

                {/* Order info + items */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
                    <span className="font-medium">{order.order_number} · {itemCount} items</span>
                    {order.waiter && <span>Cpt: {order.waiter.name}</span>}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-2">
                    {activeItems.map(i => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                  </p>
                </div>

                {/* Amount footer */}
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-100 dark:border-amber-800 flex items-center justify-end">
                  <span className="text-lg font-bold text-amber-800">₹{amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
