'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, Bill } from '@/types/database'
import { ORDER_STATUSES } from '@/lib/constants'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Receipt,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface OrderWithDetails extends Omit<Order, 'table' | 'items' | 'bill'> {
  table?: { number: number; section: string }
  items: (OrderItem & {
    menu_item: { name: string; is_veg: boolean }
  })[]
  bill?: Bill
}

interface OrdersPanelProps {
  onSettleBill: (order: OrderWithDetails) => void
}

export function OrdersPanel({ onSettleBill }: OrdersPanelProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'completed'>('active')

  const loadOrders = useCallback(async () => {
    const supabase = createClient()

    const statuses = filter === 'active'
      ? ['pending', 'preparing', 'ready', 'served']
      : ['completed']

    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, order_type, created_at, table_id, notes,
        table:tables!table_id(number, section),
        items:order_items(
          id, quantity, unit_price, total_price, notes, station, is_cancelled, kot_status,
          menu_item:menu_items(name, is_veg)
        ),
        bill:bills(id, bill_number, payment_mode, payment_status, total)
      `)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      // bills returns an array, take the first one
      const processed = data.map((o: any) => ({
        ...o,
        bill: Array.isArray(o.bill) ? o.bill[0] || null : o.bill,
      }))
      setOrders(processed as OrderWithDetails[])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadOrders()

    // Realtime updates
    const supabase = createClient()
    const channel = supabase
      .channel('orders-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kot_entries' }, () => loadOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadOrders])

  const getStatusColor = (status: string) => {
    const s = ORDER_STATUSES.find(os => os.value === status)
    return s ? s.color : 'bg-gray-500'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b dark:border-neutral-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Orders
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setFilter('completed')}
          >
            Completed
          </Button>
        </div>
      </div>

      {/* Orders List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-700" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-neutral-500">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No {filter} orders</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {orders.map(order => {
              const activeItems = order.items.filter(i => !i.is_cancelled)
              const orderTotal = activeItems.reduce((sum, i) => sum + i.total_price, 0)
              const timeAgo = formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
              const hasBill = !!order.bill

              return (
                <button
                  key={order.id}
                  onClick={() => onSettleBill(order)}
                  className="w-full text-left bg-white dark:bg-neutral-900 rounded-lg p-3 border dark:border-neutral-700 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.order_number}</span>
                      <Badge className={`${getStatusColor(order.status)} text-white text-[10px] px-1.5 py-0`}>
                        {order.status}
                      </Badge>
                    </div>
                    <span className="font-bold text-sm text-amber-700">₹{orderTotal.toFixed(0)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
                    <span>
                      {order.table
                        ? getTableDisplayName(order.table)
                        : 'Takeaway'}
                    </span>
                    <span>{timeAgo}</span>
                  </div>

                  <div className="mt-1.5 text-xs text-gray-600 dark:text-neutral-400 line-clamp-1">
                    {activeItems.map(i => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                  </div>

                  {hasBill && order.bill?.payment_status === 'partial' && (
                    <Badge className="mt-1.5 bg-amber-100 text-amber-700 text-[10px]">
                      <Clock className="h-3 w-3 mr-1" />
                      Outstanding
                    </Badge>
                  )}
                  {hasBill && order.bill?.payment_status === 'paid' && (
                    <Badge className="mt-1.5 bg-green-100 text-green-700 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Paid - {order.bill?.payment_mode?.toUpperCase()}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
