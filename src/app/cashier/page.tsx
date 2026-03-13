'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Table as TableType, Profile, OrderItem, Bill } from '@/types/database'
import { getTableDisplayName, groupTablesByDisplayGroup } from '@/lib/utils/table-display'
import { BillingDialog, OrderWithDetails } from '@/components/pos/billing-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Coffee,
  LogOut,
  Receipt,
  Clock,
  RefreshCw,
  IndianRupee,
  Banknote,
  Smartphone,
  CreditCard,
  Gift,
  CheckCircle2,
  TrendingUp,
  Plus,
  Search,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { playNewOrderSound, playFoodReadySound, unlockAudio } from '@/lib/utils/notification-sound'

type CashierTab = 'tables' | 'live_orders' | 'day_close'
type LiveOrderFilter = 'all' | 'dine_in' | 'takeaway'
type LiveOrderStatusFilter = 'all' | 'pending' | 'preparing' | 'ready' | 'served'

interface TableOrderInfo {
  orderId: string
  orderNumber: string
  itemCount: number
  total: number
  createdAt: string
  status: string
  waiterName: string | null
  hasBill: boolean
  billStatus: 'pending' | 'paid' | 'partial' | null
}

interface LiveOrder extends OrderWithDetails {
  waiterName: string | null
}

interface DaySummary {
  totalOrders: number
  totalSales: number
  cashTotal: number
  upiTotal: number
  cardTotal: number
  ncTotal: number
  outstanding: number
}

export default function CashierPage() {
  const { profile, isLoading, signOut } = useAuth(['cashier', 'admin', 'manager'])
  const [tables, setTables] = useState<TableType[]>([])
  const [waiters, setWaiters] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CashierTab>('tables')

  // Table order info
  const [tableOrderInfo, setTableOrderInfo] = useState<Map<string, TableOrderInfo>>(new Map())

  // Billing dialog
  const [billingOrder, setBillingOrder] = useState<OrderWithDetails | null>(null)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)

  // Live orders (all active orders)
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([])
  const [loadingLiveOrders, setLoadingLiveOrders] = useState(false)
  const [liveOrderFilter, setLiveOrderFilter] = useState<LiveOrderFilter>('all')
  const [liveStatusFilter, setLiveStatusFilter] = useState<LiveOrderStatusFilter>('all')
  const [orderSearchQuery, setOrderSearchQuery] = useState('')

  // Day summary
  const [daySummary, setDaySummary] = useState<DaySummary>({
    totalOrders: 0, totalSales: 0, cashTotal: 0, upiTotal: 0, cardTotal: 0, ncTotal: 0, outstanding: 0,
  })

  // Debounce ref for realtime updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sound notifications
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cashier-sound') !== '0'
    }
    return true
  })
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  const loadTables = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tables')
      .select('id, number, section, capacity, status, current_order_id')
      .order('section')
      .order('number')

    if (data) setTables(data as unknown as TableType[])
  }, [])

  const loadWaiters = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, phone, pin, is_active, created_at')
      .eq('is_active', true)

    if (data) setWaiters(data as unknown as Profile[])
  }, [])

  const loadTableOrderInfo = useCallback(async (currentTables: TableType[]) => {
    const occupiedTables = currentTables.filter(t => t.current_order_id)
    if (occupiedTables.length === 0) {
      setTableOrderInfo(new Map())
      return
    }

    const occupiedIds = occupiedTables.map(t => t.current_order_id!)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, created_at, waiter_id,
        items:order_items(quantity, total_price, is_cancelled),
        waiter:profiles!waiter_id(name),
        bill:bills(id, payment_status)
      `)
      .in('id', occupiedIds)

    if (data) {
      const infoMap = new Map<string, TableOrderInfo>()
      data.forEach((order: any) => {
        const activeItems = (order.items || []).filter((i: any) => !i.is_cancelled)
        const billData = Array.isArray(order.bill) ? order.bill[0] : order.bill
        infoMap.set(order.id, {
          orderId: order.id,
          orderNumber: order.order_number,
          itemCount: activeItems.reduce((s: number, i: any) => s + i.quantity, 0),
          total: activeItems.reduce((s: number, i: any) => s + Number(i.total_price), 0),
          createdAt: order.created_at,
          status: order.status,
          waiterName: order.waiter?.name || null,
          hasBill: !!billData,
          billStatus: billData?.payment_status || null,
        })
      })
      setTableOrderInfo(infoMap)
    }
  }, [])

  const loadLiveOrders = useCallback(async () => {
    setLoadingLiveOrders(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, order_type, created_at, table_id, notes,
        table:tables!table_id(number, section),
        items:order_items(
          id, quantity, unit_price, total_price, notes, station, is_cancelled, kot_status,
          menu_item:menu_items(name, is_veg)
        ),
        bill:bills(id, bill_number, payment_mode, payment_status, total, subtotal,
          gst_percent, gst_amount, service_charge, service_charge_removed,
          discount_amount, discount_type, discount_reason),
        waiter:profiles!waiter_id(name)
      `)
      .in('status', ['pending', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      const processed = data.map((o: any) => ({
        ...o,
        bill: Array.isArray(o.bill) ? o.bill[0] || null : o.bill,
        waiterName: o.waiter?.name || null,
      }))
      setLiveOrders(processed as LiveOrder[])
    }
    setLoadingLiveOrders(false)
  }, [])

  const loadDaySummary = useCallback(async () => {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Get bills for today
    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, payment_status')
      .gte('created_at', todayISO)

    // Get payments for today
    const { data: payments } = await supabase
      .from('payments')
      .select('mode, amount, bill_id')
      .gte('created_at', todayISO)

    const paidBills = (bills || []).filter(b => b.payment_status === 'paid')
    const partialBills = (bills || []).filter(b => b.payment_status === 'partial')

    let cashTotal = 0, upiTotal = 0, cardTotal = 0, ncTotal = 0
    ;(payments || []).forEach((p: any) => {
      const amt = Number(p.amount) || 0
      if (p.mode === 'cash') cashTotal += amt
      else if (p.mode === 'upi') upiTotal += amt
      else if (p.mode === 'card') cardTotal += amt
      else if (p.mode === 'nc') ncTotal += amt
    })

    const totalSales = paidBills.reduce((s, b) => s + Number(b.total), 0)
    const outstanding = partialBills.reduce((s, b) => s + Number(b.total), 0)

    setDaySummary({
      totalOrders: (bills || []).length,
      totalSales,
      cashTotal,
      upiTotal,
      cardTotal,
      ncTotal,
      outstanding,
    })
  }, [])

  const loadData = useCallback(async () => {
    const [tablesResult] = await Promise.all([
      loadTables(),
      loadWaiters(),
      loadDaySummary(),
    ])
    setLoading(false)
  }, [loadTables, loadWaiters, loadDaySummary])

  // After tables load, fetch order info
  useEffect(() => {
    if (tables.length > 0) {
      loadTableOrderInfo(tables)
    }
  }, [tables, loadTableOrderInfo])

  // Load live orders when tab switches
  useEffect(() => {
    if (activeTab === 'live_orders') {
      loadLiveOrders()
    }
  }, [activeTab, loadLiveOrders])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscriptions with smart notifications
  useEffect(() => {
    const supabase = createClient()

    function debouncedRefresh() {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        loadTables()
        loadDaySummary()
        if (activeTab === 'live_orders') loadLiveOrders()
      }, 500)
    }

    function handleOrderChange(payload: any) {
      if (payload.eventType === 'INSERT' && payload.new) {
        const order = payload.new
        if (soundEnabledRef.current) playNewOrderSound()
        toast.info(`New Order #${order.order_number}`, {
          description: order.order_type === 'takeaway' ? 'Takeaway order' : 'Dine-in order',
          duration: 5000,
        })
      } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'ready') {
        if (soundEnabledRef.current) playFoodReadySound()
        toast.success(`Order #${payload.new.order_number} Ready!`, {
          description: 'Food is ready to serve',
          duration: 6000,
        })
      }
      debouncedRefresh()
    }

    const channel = supabase
      .channel('cashier-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrderChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedRefresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Auto-retry on channel error
          setTimeout(() => {
            supabase.removeChannel(channel)
            // The effect will re-run and create a new subscription
          }, 3000)
        }
      })

    // Fallback: auto-refresh every 15 seconds in case realtime disconnects silently
    const fallbackInterval = setInterval(() => {
      loadTables()
      if (activeTab === 'live_orders') loadLiveOrders()
    }, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallbackInterval)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [loadTables, loadDaySummary, loadLiveOrders, activeTab])

  // Unlock Web Audio API on first user interaction
  useEffect(() => {
    function unlock() {
      unlockAudio()
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  // Open billing dialog for a table
  async function openTableBilling(table: TableType) {
    if (!table.current_order_id || table.status !== 'occupied') return

    const supabase = createClient()
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, order_type, created_at, table_id, notes,
        table:tables!table_id(number, section),
        items:order_items(
          id, quantity, unit_price, total_price, notes, station, is_cancelled, kot_status,
          menu_item:menu_items(name, is_veg)
        ),
        bill:bills(id, bill_number, payment_mode, payment_status, total, subtotal,
          gst_percent, gst_amount, service_charge, service_charge_removed,
          discount_amount, discount_type, discount_reason)
      `)
      .eq('id', table.current_order_id)
      .single()

    if (orderData) {
      const processed = {
        ...orderData,
        bill: Array.isArray(orderData.bill) ? orderData.bill[0] || null : orderData.bill,
      } as unknown as OrderWithDetails
      setBillingOrder(processed)
      setBillingDialogOpen(true)
    } else {
      toast.error('Could not load order for this table')
    }
  }

  function openLiveOrderBilling(order: OrderWithDetails) {
    setBillingOrder(order)
    setBillingDialogOpen(true)
  }

  function handleBillSettled() {
    loadTables()
    loadDaySummary()
    if (activeTab === 'live_orders') loadLiveOrders()
  }

  // Derived status counts
  const statusCounts = useMemo(() => {
    let foodReady = 0
    let running = 0
    let toSettle = 0
    tableOrderInfo.forEach((info) => {
      if (info.status === 'ready') foodReady++
      if (!info.hasBill) running++
      if (info.hasBill && info.billStatus === 'pending') toSettle++
    })
    return { foodReady, running, toSettle }
  }, [tableOrderInfo])

  // Filtered live orders
  const filteredLiveOrders = useMemo(() => {
    let filtered = liveOrders
    if (liveOrderFilter !== 'all') {
      filtered = filtered.filter(o => o.order_type === liveOrderFilter)
    }
    if (liveStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === liveStatusFilter)
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.trim().toLowerCase()
      filtered = filtered.filter(o => o.order_number.toLowerCase().includes(q))
    }
    return filtered
  }, [liveOrders, liveOrderFilter, liveStatusFilter, orderSearchQuery])

  // Live order status counts for filter chips
  const liveOrderStatusCounts = useMemo(() => {
    const typeFiltered = liveOrderFilter === 'all'
      ? liveOrders
      : liveOrders.filter(o => o.order_type === liveOrderFilter)
    return {
      all: typeFiltered.length,
      pending: typeFiltered.filter(o => o.status === 'pending').length,
      preparing: typeFiltered.filter(o => o.status === 'preparing').length,
      ready: typeFiltered.filter(o => o.status === 'ready').length,
      served: typeFiltered.filter(o => o.status === 'served').length,
    }
  }, [liveOrders, liveOrderFilter])

  // Helper: table card style based on status + bill
  function getTableCardStyle(table: TableType, info: TableOrderInfo | null | undefined): string {
    if (table.status === 'available') {
      return 'border-gray-200 bg-white shadow-sm cursor-default'
    }
    if (table.status === 'reserved') {
      return 'border-yellow-400 bg-yellow-50 opacity-80 cursor-default'
    }
    // occupied — dark filled cards for active tables
    if (info?.hasBill) {
      if (info.billStatus === 'paid') {
        return 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg cursor-pointer active:scale-95'
      }
      return 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg cursor-pointer active:scale-95'
    }
    return 'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:shadow-lg cursor-pointer active:scale-95'
  }

  function getTableNumberColor(table: TableType, info: TableOrderInfo | null | undefined): string {
    if (table.status === 'available') return 'text-gray-400'
    if (table.status === 'reserved') return 'text-yellow-800'
    // Active tables have dark bg, so use white text
    return 'text-white'
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6]">
        <header className="bg-white border-b px-6 py-3 flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-700" />
          <span className="font-semibold">Cashier</span>
        </header>
        <div className="p-6 space-y-6">
          <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="grid grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF9F6] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Coffee className="h-5 w-5 text-amber-700" />
          <span className="font-bold text-lg text-gray-900">Cashier</span>
          {profile?.name && <span className="text-sm text-gray-600 font-medium">({profile.name})</span>}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'tables' as CashierTab, label: 'Tables' },
            { key: 'live_orders' as CashierTab, label: 'Live Orders' },
            { key: 'day_close' as CashierTab, label: 'Day Close' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {statusCounts.foodReady > 0 && (
            <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">
              <UtensilsCrossed className="h-3 w-3 mr-1" />
              {statusCounts.foodReady} Ready
            </Badge>
          )}
          {statusCounts.toSettle > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">
              <Receipt className="h-3 w-3 mr-1" />
              {statusCounts.toSettle} To Settle
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a href="/pos">
            <Button size="sm" className="bg-amber-700 hover:bg-amber-800">
              <Plus className="h-4 w-4 mr-1" />
              New Order
            </Button>
          </a>
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <a href="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSoundEnabled(prev => {
                const next = !prev
                localStorage.setItem('cashier-sound', next ? '1' : '0')
                if (next) unlockAudio()
                return next
              })
            }}
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { loadData() }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Day Summary Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-6 text-sm overflow-x-auto font-medium">
          <div className="flex items-center gap-1.5 text-gray-800">
            <Receipt className="h-4 w-4" />
            <span className="font-bold">{daySummary.totalOrders}</span>
            <span className="text-gray-500">bills</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-800 font-bold">
            <TrendingUp className="h-4 w-4" />
            <span>₹{daySummary.totalSales.toLocaleString('en-IN')}</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-1.5 text-green-800">
            <Banknote className="h-4 w-4" />
            <span>₹{daySummary.cashTotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-800">
            <Smartphone className="h-4 w-4" />
            <span>₹{daySummary.upiTotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-800">
            <CreditCard className="h-4 w-4" />
            <span>₹{daySummary.cardTotal.toLocaleString('en-IN')}</span>
          </div>
          {daySummary.ncTotal > 0 && (
            <div className="flex items-center gap-1.5 text-orange-700">
              <Gift className="h-4 w-4" />
              <span>₹{daySummary.ncTotal.toLocaleString('en-IN')}</span>
            </div>
          )}
          {daySummary.outstanding > 0 && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-1.5 text-red-700 font-bold">
                <Clock className="h-4 w-4" />
                <span>₹{daySummary.outstanding.toLocaleString('en-IN')} due</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'tables' && (
          <div className="p-6 space-y-6">
            {/* Table Legend */}
            <div className="flex items-center gap-5 text-xs text-gray-600 pb-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">Legend:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-white border border-gray-300" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-600" />
                <span>Running</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-600" />
                <span>Billed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-400" />
                <span>Reserved</span>
              </div>
            </div>

            {groupTablesByDisplayGroup(tables).map(group => {
              const occupiedCount = group.tables.filter(t => t.status === 'occupied').length
              const runningCount = group.tables.filter(t => {
                if (t.status !== 'occupied' || !t.current_order_id) return false
                const inf = tableOrderInfo.get(t.current_order_id)
                return inf && !inf.hasBill
              }).length
              const billedCount = group.tables.filter(t => {
                if (t.status !== 'occupied' || !t.current_order_id) return false
                const inf = tableOrderInfo.get(t.current_order_id)
                return inf?.hasBill && inf.billStatus !== 'paid'
              }).length

              return (
                <div key={group.group}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-bold text-gray-900">{group.label}</h2>
                    <Badge variant="outline" className="text-xs">
                      {occupiedCount}/{group.tables.length}
                      {runningCount > 0 && <span className="text-green-600 ml-1">({runningCount} running)</span>}
                      {billedCount > 0 && <span className="text-amber-600 ml-1">({billedCount} billed)</span>}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    {group.tables.map(table => {
                      const isOccupied = table.status === 'occupied'
                      const info = table.current_order_id ? tableOrderInfo.get(table.current_order_id) : null
                      const elapsedMin = info ? Math.floor((Date.now() - new Date(info.createdAt).getTime()) / 60000) : null

                      return (
                        <button
                          key={table.id}
                          onClick={() => isOccupied && openTableBilling(table)}
                          disabled={!isOccupied}
                          className={`relative p-2 rounded-lg text-center border-2 min-h-[72px] transition-all ${getTableCardStyle(table, info)}`}
                        >
                          <p className={`text-base font-bold ${getTableNumberColor(table, info)}`}>
                            {getTableDisplayName(table)}
                          </p>
                          {isOccupied && info ? (
                            <div className="mt-0.5 space-y-0.5">
                              <p className="text-sm font-bold text-white">
                                ₹{info.total.toLocaleString('en-IN')}
                              </p>
                              <p className="text-[11px] text-white/70 font-medium">
                                {elapsedMin !== null ? (elapsedMin < 1 ? '<1 Min' : `${elapsedMin} Min`) : ''}
                              </p>
                              {info.hasBill && info.billStatus === 'pending' && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-white/20 text-white border-0 font-semibold">
                                  Billed
                                </Badge>
                              )}
                              {info.hasBill && info.billStatus === 'paid' && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-white/20 text-white border-0 font-semibold">
                                  Paid
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] capitalize text-gray-500 mt-0.5 font-medium">
                              {table.status}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'live_orders' && (
          <div className="p-6">
            {/* Search + Filters Bar */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold text-lg flex items-center gap-2 shrink-0">
                  <Receipt className="h-5 w-5" />
                  Live Orders
                </h2>
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search order #..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={loadLiveOrders}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>

              {/* Filters row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Order type filter */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {([
                    { key: 'all' as LiveOrderFilter, label: 'All' },
                    { key: 'dine_in' as LiveOrderFilter, label: 'Dine In' },
                    { key: 'takeaway' as LiveOrderFilter, label: 'Takeaway' },
                  ]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setLiveOrderFilter(f.key)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        liveOrderFilter === f.key
                          ? 'bg-white shadow-sm font-medium'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-5" />

                {/* Status filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { key: 'all' as LiveOrderStatusFilter, label: 'All', count: liveOrderStatusCounts.all, color: 'bg-gray-100 text-gray-700' },
                    { key: 'pending' as LiveOrderStatusFilter, label: 'Pending', count: liveOrderStatusCounts.pending, color: 'bg-yellow-100 text-yellow-700' },
                    { key: 'preparing' as LiveOrderStatusFilter, label: 'Preparing', count: liveOrderStatusCounts.preparing, color: 'bg-blue-100 text-blue-700' },
                    { key: 'ready' as LiveOrderStatusFilter, label: 'Ready', count: liveOrderStatusCounts.ready, color: 'bg-green-100 text-green-700' },
                    { key: 'served' as LiveOrderStatusFilter, label: 'Served', count: liveOrderStatusCounts.served, color: 'bg-purple-100 text-purple-700' },
                  ]).filter(f => f.key === 'all' || f.count > 0).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setLiveStatusFilter(f.key)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        liveStatusFilter === f.key
                          ? `${f.color} border-current font-medium`
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Order cards grid */}
            {loadingLiveOrders ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-700" />
              </div>
            ) : filteredLiveOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No active orders</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredLiveOrders.map(order => {
                  const activeItems = order.items.filter(i => !i.is_cancelled)
                  const orderTotal = activeItems.reduce((sum, i) => sum + i.total_price, 0)
                  const timeAgo = formatDistanceToNow(new Date(order.created_at), { addSuffix: true })
                  const hasBill = !!order.bill
                  const isDineIn = order.order_type === 'dine_in'

                  return (
                    <button
                      key={order.id}
                      onClick={() => openLiveOrderBilling(order)}
                      className="w-full text-left bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.98]"
                    >
                      {/* Top row: order number + badge + total */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-gray-900">{order.order_number}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${isDineIn ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-orange-200 text-orange-700 bg-orange-50'}`}
                          >
                            {isDineIn ? 'Dine In' : 'Takeaway'}
                          </Badge>
                        </div>
                        <span className="font-bold text-base text-amber-800">₹{orderTotal.toFixed(0)}</span>
                      </div>

                      {/* Table + captain + time */}
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                        <div className="flex items-center gap-1.5">
                          {isDineIn && order.table && (
                            <span className="font-medium">{getTableDisplayName(order.table)}</span>
                          )}
                          {order.waiterName && (
                            <span className="text-gray-400">{isDineIn && order.table ? '·' : ''} {order.waiterName}</span>
                          )}
                        </div>
                        <span>{timeAgo}</span>
                      </div>

                      {/* Status + item count */}
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          className={`text-[10px] capitalize border-0 ${
                            order.status === 'ready' ? 'bg-green-100 text-green-700' :
                            order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {order.status}
                        </Badge>
                        <span className="text-xs text-gray-600 font-medium">
                          {activeItems.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>

                      {/* Items summary */}
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {activeItems.map(i => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                      </p>

                      {/* Payment status */}
                      {hasBill && order.bill?.payment_status === 'paid' && (
                        <Badge className="mt-2 bg-green-100 text-green-700 text-[10px] border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Paid - {order.bill?.payment_mode?.toUpperCase()}
                        </Badge>
                      )}
                      {hasBill && order.bill?.payment_status === 'partial' && (
                        <Badge className="mt-2 bg-amber-100 text-amber-700 text-[10px] border-0">
                          <Clock className="h-3 w-3 mr-1" />
                          Outstanding
                        </Badge>
                      )}
                      {hasBill && order.bill?.payment_status === 'pending' && (
                        <Badge className="mt-2 bg-orange-100 text-orange-700 text-[10px] border-0">
                          <Receipt className="h-3 w-3 mr-1" />
                          Bill Created
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'day_close' && (
          <div className="p-6 max-w-2xl mx-auto">
            <h2 className="font-semibold text-lg mb-6">Today&apos;s Summary</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 border">
                <p className="text-sm text-gray-500 mb-1">Total Bills</p>
                <p className="text-3xl font-bold">{daySummary.totalOrders}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border">
                <p className="text-sm text-gray-500 mb-1">Total Sales</p>
                <p className="text-3xl font-bold text-amber-700">₹{daySummary.totalSales.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border divide-y">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-green-700" />
                  </div>
                  <span className="font-medium">Cash</span>
                </div>
                <span className="font-bold text-lg">₹{daySummary.cashTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-blue-700" />
                  </div>
                  <span className="font-medium">UPI</span>
                </div>
                <span className="font-bold text-lg">₹{daySummary.upiTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-purple-700" />
                  </div>
                  <span className="font-medium">Card</span>
                </div>
                <span className="font-bold text-lg">₹{daySummary.cardTotal.toLocaleString('en-IN')}</span>
              </div>
              {daySummary.ncTotal > 0 && (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Gift className="h-5 w-5 text-orange-600" />
                    </div>
                    <span className="font-medium">NC (Complimentary)</span>
                  </div>
                  <span className="font-bold text-lg text-orange-600">₹{daySummary.ncTotal.toLocaleString('en-IN')}</span>
                </div>
              )}
              {daySummary.outstanding > 0 && (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="font-medium">Outstanding</span>
                  </div>
                  <span className="font-bold text-lg text-red-600">₹{daySummary.outstanding.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <a href="/admin/eod">
                <Button className="w-full h-12 bg-amber-700 hover:bg-amber-800 text-base">
                  <IndianRupee className="h-5 w-5 mr-2" />
                  Open Day Close / EOD
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Billing Dialog */}
      <BillingDialog
        order={billingOrder}
        open={billingDialogOpen}
        onClose={() => { setBillingDialogOpen(false); setBillingOrder(null) }}
        onBillSettled={handleBillSettled}
        tables={tables}
        waiters={waiters}
      />
    </div>
  )
}
