'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Category, MenuItem, CartItem, Table as TableType, StationType, OrderItem } from '@/types/database'
import { getTableDisplayName, groupTablesByDisplayGroup } from '@/lib/utils/table-display'
import { printKOT } from '@/lib/utils/print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Coffee,
  LogOut,
  X,
  ArrowLeft,
  ArrowRightLeft,
  Menu,
  UtensilsCrossed,
  LayoutGrid,
  Clock,
  MessageSquare,
  ChevronRight,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { toast } from 'sonner'
import { STATIONS } from '@/lib/constants'
import { playFoodReadySound, unlockAudio } from '@/lib/utils/notification-sound'

type View = 'tables' | 'categories' | 'menu' | 'order_detail'

interface ActiveOrder {
  id: string
  order_number: string
  status: string
  order_type: string
  table_id: string | null
  notes: string | null
  created_at?: string
  items: (OrderItem & { menu_item: { name: string; is_veg: boolean } })[]
}

interface TableOrderInfo {
  itemCount: number
  total: number
  createdAt: string
  billPrintCount: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d`
}

export default function WaiterPage() {
  const { profile, isLoading, signOut } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<TableType[]>([])
  const [loading, setLoading] = useState(true)

  // State
  const [view, setView] = useState<View>('tables')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null)
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in')

  // Existing order (for add items flow)
  const [addingToOrder, setAddingToOrder] = useState<ActiveOrder | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  // Table transfer
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  // Hamburger menu
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sound alerts for order ready
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('waiter-sound') !== '0'
    }
    return true
  })
  const soundEnabledRef = useRef(soundEnabled)

  // Order placement guard — prevents double-submit
  const [placing, setPlacing] = useState(false)
  const placingRef = useRef(false)

  // Track which cart items have note input open
  const [noteOpenIndices, setNoteOpenIndices] = useState<Set<number>>(new Set())

  // Time ticker for elapsed time
  const [, setTick] = useState(0)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [catResult, itemResult, tableResult] = await Promise.all([
      supabase.from('categories').select('id, name, display_order, is_active').eq('is_active', true).order('display_order'),
      supabase.from('menu_items').select('id, name, price, category_id, station, is_veg, is_active, category:categories(id, name)').eq('is_active', true).order('name'),
      supabase.from('tables').select('id, number, section, capacity, status, current_order_id').order('section').order('number'),
    ])

    if (catResult.data) setCategories(catResult.data as unknown as Category[])
    if (itemResult.data) setMenuItems(itemResult.data as unknown as MenuItem[])
    if (tableResult.data) setTables(tableResult.data as unknown as TableType[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription for tables
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('waiter-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  // Keep soundEnabledRef in sync
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Unlock Web Audio API on first user interaction
  useEffect(() => {
    function unlock() {
      unlockAudio()
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Realtime: listen for KOT ready alerts (all stations)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('waiter-kot-ready')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kot_entries' },
        async (payload) => {
          const newRow = payload.new as { id: string; status: string; station: string; order_id: string }
          if (newRow.status !== 'ready') return

          // Fetch order + table info for the toast
          const { data: kot } = await supabase
            .from('kot_entries')
            .select(`
              kot_number,
              station,
              order:orders!order_id(
                order_number,
                table:tables!table_id(number, section)
              )
            `)
            .eq('id', newRow.id)
            .single()

          const tableName = (kot?.order as any)?.table
            ? getTableDisplayName((kot?.order as any).table)
            : 'Takeaway'
          const stationLabel = STATIONS.find(s => s.value === (kot?.station || newRow.station))?.label || 'Order'
          const orderNum = (kot?.order as any)?.order_number || ''

          // Play sound
          if (soundEnabledRef.current) {
            playFoodReadySound()
          }

          // Prominent toast
          toast.success(
            `${stationLabel} ready! ${tableName} - ${orderNum}`,
            { duration: 8000 }
          )

          // Browser notification when tab is in background
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`${stationLabel} Ready!`, {
              body: `${tableName} - ${orderNum}`,
              icon: '/icons/icon-192.png',
              tag: `kot-ready-${newRow.id}`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Realtime: listen for ring alerts from bar/kitchen
  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel('waiter-ring')
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        if (payload.waiter_id !== profile.id) return
        if (soundEnabledRef.current) {
          playFoodReadySound()
        }
        toast.warning(
          `Bar is calling you! ${payload.table_name} - ${payload.kot_number}`,
          { duration: 10000 }
        )
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Bar is calling you!', {
            body: `${payload.table_name} - ${payload.kot_number}`,
            icon: '/icons/icon-192.png',
            tag: `ring-${payload.kot_number}`,
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  // Tick every 60s to update elapsed times
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch active order for an occupied table
  async function fetchActiveOrder(table: TableType) {
    if (!table.current_order_id) return null
    setLoadingOrder(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, order_type, table_id, notes, created_at, bill_print_count,
        items:order_items(*, menu_item:menu_items(name, is_veg)),
        bill:bills(id)
      `)
      .eq('id', table.current_order_id)
      .single()
    setLoadingOrder(false)
    return data as ActiveOrder | null
  }

  async function selectTable(table: TableType) {
    setSelectedTable(table)
    setOrderType('dine_in')

    if (table.status === 'occupied' && table.current_order_id) {
      const order = await fetchActiveOrder(table)
      if (order) {
        const billPrinted = (order as any).bill_print_count > 0
        const billExists = Array.isArray((order as any).bill) ? (order as any).bill.length > 0 : !!(order as any).bill
        const orderCompleted = order.status === 'completed'

        // If bill printed/exists or order completed, reuse table for new order
        if (billPrinted || billExists || orderCompleted) {
          // Ensure old order has bill_print_count >= 1 for Pending Settlement tracking
          if (!billPrinted) {
            const supabase = createClient()
            supabase.from('orders')
              .update({ bill_print_count: 1 })
              .eq('id', order.id)
              .then(() => {})
          }
          setActiveOrder(null)
          setAddingToOrder(null)
          setSearchQuery('')
          setActiveCategory('all')
          setView('categories')
          return
        }
        setActiveOrder(order)
        setView('order_detail')
        return
      }
    }
    // New order — go to categories
    setActiveOrder(null)
    setAddingToOrder(null)
    setSearchQuery('')
    setActiveCategory('all')
    setView('categories')
  }

  function startTakeaway() {
    setSelectedTable(null)
    setActiveOrder(null)
    setAddingToOrder(null)
    setOrderType('takeaway')
    setSearchQuery('')
    setActiveCategory('all')
    setDrawerOpen(false)
    setView('categories')
  }

  function startAddItems() {
    if (!activeOrder) return
    setAddingToOrder(activeOrder)
    setSearchQuery('')
    setActiveCategory('all')
    setView('categories')
  }

  function selectCategory(catId: string) {
    setActiveCategory(catId)
    setView('menu')
  }

  // Cart operations
  function addToCart(item: MenuItem) {
    const existingIndex = cart.findIndex(c => c.menu_item.id === item.id && !c.variant)
    if (existingIndex >= 0) {
      const updated = [...cart]
      updated[existingIndex].quantity += 1
      updated[existingIndex].total_price = updated[existingIndex].unit_price * updated[existingIndex].quantity
      setCart(updated)
    } else {
      setCart([...cart, {
        menu_item: item,
        variant: null,
        addons: [],
        quantity: 1,
        notes: '',
        unit_price: item.price,
        total_price: item.price,
      }])
    }
  }

  function updateQuantity(index: number, delta: number) {
    const updated = [...cart]
    updated[index].quantity += delta
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1)
    } else {
      updated[index].total_price = updated[index].unit_price * updated[index].quantity
    }
    setCart(updated)
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index))
  }

  function updateNote(index: number, note: string) {
    const updated = [...cart]
    updated[index].notes = note
    setCart(updated)
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  async function placeOrder() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    // Double-submit guard — ref check prevents race conditions
    if (placingRef.current) return
    placingRef.current = true
    setPlacing(true)

    try {
      const supabase = createClient()
      let orderId: string
      let orderNumber: string
      let tableNum = selectedTable?.number || null
      let tableSec = selectedTable?.section || null
      let currentOrderType = orderType

      if (addingToOrder) {
        orderId = addingToOrder.id
        orderNumber = addingToOrder.order_number
        currentOrderType = addingToOrder.order_type as 'dine_in' | 'takeaway'
      } else {
        const { data: orderNum } = await supabase.rpc('generate_order_number')

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable?.id || null,
            order_number: orderNum || `ORD-${Date.now()}`,
            status: 'pending',
            order_type: orderType,
            waiter_id: profile?.id || null,
          })
          .select()
          .single()

        if (orderError || !order) {
          toast.error('Failed to create order')
          return
        }
        orderId = order.id
        orderNumber = order.order_number
      }

      const orderItems = cart.map(item => ({
        order_id: orderId,
        menu_item_id: item.menu_item.id,
        variant_id: item.variant?.id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes || null,
        kot_status: 'pending' as const,
        station: item.menu_item.station,
      }))

      await supabase.from('order_items').insert(orderItems)

      // Create KOT entries per station
      const stationGroups = new Map<StationType, typeof orderItems>()
      orderItems.forEach(item => {
        const existing = stationGroups.get(item.station) || []
        existing.push(item)
        stationGroups.set(item.station, existing)
      })

      for (const [station, stationItems] of stationGroups) {
        const { data: kotNum } = await supabase.rpc('generate_kot_number', { p_station: station })
        const kotNumber = kotNum || `KOT-${Date.now()}`
        await supabase.from('kot_entries').insert({
          order_id: orderId,
          station,
          kot_number: kotNumber,
          status: 'pending',
        })

        const printItems = stationItems.map(si => {
          const cartItem = cart.find(c => c.menu_item.id === si.menu_item_id)
          return {
            name: cartItem?.menu_item.name || 'Unknown',
            quantity: si.quantity,
            variant: cartItem?.variant?.name,
            notes: si.notes || undefined,
          }
        })

        printKOT(
          station,
          kotNumber,
          orderNumber,
          tableNum,
          tableSec,
          currentOrderType as 'dine_in' | 'takeaway',
          printItems,
          undefined,
          profile?.name || null,
        ).catch(() => {
          toast.error(`KOT print failed for ${station}`)
        })
      }

      if (!addingToOrder && selectedTable) {
        await supabase
          .from('tables')
          .update({ status: 'occupied', current_order_id: orderId })
          .eq('id', selectedTable.id)
      }

      const action = addingToOrder ? 'Items added to' : 'Order'
      toast.success(`${action} ${orderNumber} sent to kitchen!`)
      setConfirmDialogOpen(false)
      setCart([])
      setAddingToOrder(null)
      setActiveOrder(null)
      setView('tables')
      setSelectedTable(null)
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to place order')
    } finally {
      placingRef.current = false
      setPlacing(false)
    }
  }

  // Table transfer
  async function transferTable(newTable: TableType) {
    if (!activeOrder || !selectedTable) return
    setTransferring(true)
    const supabase = createClient()

    await supabase
      .from('orders')
      .update({ table_id: newTable.id })
      .eq('id', activeOrder.id)

    await supabase
      .from('tables')
      .update({ status: 'available', current_order_id: null })
      .eq('id', selectedTable.id)

    await supabase
      .from('tables')
      .update({ status: 'occupied', current_order_id: activeOrder.id })
      .eq('id', newTable.id)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      action: 'table_transfer',
      order_id: activeOrder.id,
      performed_by: user?.id || null,
      details: {
        order_number: activeOrder.order_number,
        from_table: selectedTable.number,
        from_section: selectedTable.section,
        to_table: newTable.number,
        to_section: newTable.section,
      },
    })

    toast.success(`Transferred to ${getTableDisplayName(newTable)}`)
    setTransferring(false)
    setTransferDialogOpen(false)
    setActiveOrder(null)
    setView('tables')
    loadData()
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Order confirmation
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  function handlePlaceOrder() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setConfirmDialogOpen(true)
  }

  // Table order summaries (with createdAt for time elapsed)
  const [tableOrderInfo, setTableOrderInfo] = useState<Map<string, TableOrderInfo>>(new Map())

  useEffect(() => {
    async function fetchTableOrderInfo() {
      const occupiedIds = tables.filter(t => t.current_order_id).map(t => t.current_order_id!)
      if (occupiedIds.length === 0) { setTableOrderInfo(new Map()); return }
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('id, created_at, bill_print_count, items:order_items(quantity, total_price, is_cancelled)')
        .in('id', occupiedIds)
      if (data) {
        const infoMap = new Map<string, TableOrderInfo>()
        data.forEach((order: any) => {
          const activeItems = (order.items || []).filter((i: any) => !i.is_cancelled)
          infoMap.set(order.id, {
            itemCount: activeItems.reduce((s: number, i: any) => s + i.quantity, 0),
            total: activeItems.reduce((s: number, i: any) => s + Number(i.total_price), 0),
            createdAt: order.created_at,
            billPrintCount: order.bill_print_count || 0,
          })
        })
        setTableOrderInfo(infoMap)
      }
    }
    if (tables.length > 0) fetchTableOrderInfo()
  }, [tables])

  // Category item counts
  const categoryItemCounts = new Map<string, number>()
  categories.forEach(cat => {
    categoryItemCounts.set(cat.id, menuItems.filter(i => i.category_id === cat.id).length)
  })

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-800">
        <header className="bg-amber-700 text-white px-4 py-3.5 flex items-center gap-2">
          <Coffee className="h-5 w-5" />
          <span className="font-semibold text-base">Captain</span>
        </header>
        <div className="p-4 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-32 bg-gray-200 dark:bg-neutral-600 rounded animate-pulse" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className="h-24 bg-gray-200 dark:bg-neutral-600 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ======== CART FOOTER (shared between categories + menu views) ========
  const cartFooter = cart.length > 0 && (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-800 border-t dark:border-neutral-600 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="p-3">
        <Sheet>
          <SheetTrigger
            render={<Button className="w-full h-14 bg-amber-700 hover:bg-amber-800 justify-between text-base rounded-xl" />}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-bold">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            </span>
            <span className="flex items-center gap-1 font-bold">
              ₹{Math.round(subtotal)} <ChevronRight className="h-4 w-4" />
            </span>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-lg">
                {addingToOrder
                  ? `Add to ${addingToOrder.order_number}`
                  : selectedTable ? getTableDisplayName(selectedTable) : 'Takeaway'} — {itemCount} items
              </SheetTitle>
            </SheetHeader>
            <div className="mt-3 space-y-2 overflow-y-auto flex-1" style={{ maxHeight: 'calc(75vh - 200px)' }}>
              {cart.map((item, index) => (
                <div key={index} className="bg-gray-50 dark:bg-neutral-700 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{item.menu_item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">₹{item.unit_price} each</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="h-8 w-8 rounded-lg border border-gray-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 flex items-center justify-center active:scale-95"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-bold w-7 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="h-8 w-8 rounded-lg border border-gray-300 dark:border-neutral-500 bg-white dark:bg-neutral-800 flex items-center justify-center active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold w-14 text-right shrink-0">₹{Math.round(item.total_price)}</p>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0 active:scale-95"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Item note */}
                  {(item.notes || noteOpenIndices.has(index)) ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                      <Input
                        autoFocus={noteOpenIndices.has(index)}
                        value={item.notes}
                        onChange={(e) => updateNote(index, e.target.value)}
                        onBlur={() => {
                          if (!item.notes.trim()) {
                            updateNote(index, '')
                            setNoteOpenIndices(prev => { const next = new Set(prev); next.delete(index); return next })
                          }
                        }}
                        placeholder="e.g., no onion, extra spicy..."
                        className="h-8 text-xs bg-white dark:bg-neutral-700 dark:border-neutral-500 dark:text-neutral-100 flex-1"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setNoteOpenIndices(prev => new Set(prev).add(index))}
                      className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-amber-700"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Add note
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t dark:border-neutral-600 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-amber-700">₹{Math.round(subtotal)}</span>
              </div>
              <Button className="w-full h-14 bg-amber-700 hover:bg-amber-800 text-base font-bold rounded-xl"
                onClick={handlePlaceOrder}>
                {addingToOrder ? `Add Items — ₹${Math.round(subtotal)}` : 'Send to Kitchen'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )

  // ======== CONFIRM DIALOG (shared) ========
  const confirmDialog = (
    <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!placing) setConfirmDialogOpen(open) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-neutral-400">
            {addingToOrder
              ? `Add ${itemCount} items to ${addingToOrder.order_number}?`
              : `Place order for ${selectedTable ? getTableDisplayName(selectedTable) : 'Takeaway'}?`}
          </p>
          <div className="bg-gray-50 dark:bg-neutral-700 rounded-xl p-3 space-y-1.5 max-h-52 overflow-y-auto">
            {cart.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm">
                  <span className="flex-1 mr-2">{item.quantity}x {item.menu_item.name}</span>
                  <span className="font-medium shrink-0">₹{Math.round(item.total_price)}</span>
                </div>
                {item.notes?.trim() && (
                  <p className="text-xs text-amber-600 ml-4 flex items-center gap-1 mt-0.5">
                    <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                    {item.notes.trim()}
                  </p>
                )}
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>₹{Math.round(subtotal)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setConfirmDialogOpen(false)} disabled={placing}>
              Back
            </Button>
            <Button
              className="flex-1 h-12 bg-amber-700 hover:bg-amber-800 font-bold"
              onClick={placeOrder}
              disabled={placing}
            >
              {placing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ======== TABLE VIEW ========
  if (view === 'tables') {
    const occupiedCount = tables.filter(t => t.status === 'occupied').length

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-800">
        {/* Header */}
        <header className="bg-amber-700 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="p-1.5 -ml-1 rounded-lg hover:bg-amber-600 active:scale-95">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="font-bold text-base leading-tight">Tables</p>
              <p className="text-xs text-amber-200 mt-0.5">{occupiedCount} occupied / {tables.length} total</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {profile?.name && (
              <span className="text-xs text-amber-200 mr-1">{profile.name}</span>
            )}
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <a href="/admin">
                <Button variant="ghost" size="sm" className="text-white hover:bg-amber-600 text-xs">Admin</Button>
              </a>
            )}
          </div>
        </header>

        {/* Table grid */}
        <div className="p-3 space-y-5 pb-24">
          {groupTablesByDisplayGroup(tables).map(group => {
            const sectionOccupied = group.tables.filter(t => t.status === 'occupied').length
            return (
              <div key={group.group}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <h2 className="font-bold text-sm text-gray-700 dark:text-neutral-300">{group.label}</h2>
                  <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium">{sectionOccupied}/{group.tables.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {group.tables.map(table => {
                    const info = table.current_order_id ? tableOrderInfo.get(table.current_order_id) : null
                    // Table is "effectively available" if bill was printed (captain can seat new party)
                    const billPrinted = (info?.billPrintCount || 0) > 0
                    const isOccupied = table.status === 'occupied' && !billPrinted

                    return (
                      <button
                        key={table.id}
                        onClick={() => selectTable(table)}
                        className={`relative p-3 rounded-xl text-center border-2 transition-all active:scale-95 min-h-[88px] flex flex-col items-center justify-center ${
                          isOccupied
                            ? 'border-transparent bg-amber-700 text-white shadow-sm'
                            : table.status === 'reserved'
                            ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30'
                            : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                        }`}
                      >
                        <p className={`text-xl font-bold leading-none ${
                          isOccupied ? 'text-white' : 'text-gray-400 dark:text-neutral-500'
                        }`}>
                          {getTableDisplayName(table)}
                        </p>
                        {isOccupied && info ? (
                          <div className="mt-1.5 w-full">
                            <p className="text-base font-bold text-white leading-none">
                              ₹{Math.round(info.total).toLocaleString('en-IN')}
                            </p>
                            <div className="flex items-center justify-center gap-1.5 mt-1 text-amber-200">
                              <span className="text-[11px]">{info.itemCount} items</span>
                              {info.createdAt && (
                                <>
                                  <span className="text-amber-400">·</span>
                                  <span className="text-[11px] flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {timeAgo(info.createdAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className={`text-xs mt-1 capitalize ${
                            table.status === 'reserved' ? 'text-yellow-700' : 'text-gray-400 dark:text-neutral-500'
                          }`}>
                            {table.status === 'available' || billPrinted ? '' : table.status}
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

        {/* FAB for takeaway */}
        <button
          onClick={startTakeaway}
          className="fixed bottom-6 right-4 z-20 h-14 px-5 rounded-full bg-amber-700 text-white shadow-lg flex items-center gap-2 active:scale-95 transition-transform hover:bg-amber-800 pb-[env(safe-area-inset-bottom)]"
        >
          <Plus className="h-5 w-5" />
          <span className="font-bold text-sm">Takeaway</span>
        </button>

        {/* Hamburger drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-72">
            <div className="py-4 space-y-6">
              {/* Profile section */}
              <div className="px-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-11 w-11 rounded-full bg-amber-100 flex items-center justify-center">
                    <Coffee className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-bold text-base">{profile?.name || 'Captain'}</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 capitalize">{profile?.role}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Menu items */}
              <div className="space-y-1">
                <button
                  onClick={startTakeaway}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-500 text-left transition-colors active:scale-[0.98]"
                >
                  <UtensilsCrossed className="h-5 w-5 text-gray-500 dark:text-neutral-400" />
                  <span className="text-sm font-medium">New Takeaway</span>
                </button>

                <button
                  onClick={() => { setDrawerOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-500 text-left transition-colors active:scale-[0.98]"
                >
                  <LayoutGrid className="h-5 w-5 text-gray-500 dark:text-neutral-400" />
                  <span className="text-sm font-medium">All Tables</span>
                </button>
              </div>

              <Separator />

              {/* Sound toggle */}
              <div className="px-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">Order Ready Alerts</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSoundEnabled(prev => {
                      const next = !prev
                      localStorage.setItem('waiter-sound', next ? '1' : '0')
                      if (next) unlockAudio()
                      return next
                    })
                  }}
                  className={soundEnabled ? 'text-green-600' : 'text-gray-400'}
                >
                  {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>
              </div>

              <Separator />

              {/* Theme toggle */}
              <div className="px-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">Theme</span>
                <ThemeToggle />
              </div>

              <Separator />

              <div>
                <button
                  onClick={() => { setDrawerOpen(false); signOut() }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-left transition-colors active:scale-[0.98]"
                >
                  <LogOut className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Logout</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  // ======== ORDER DETAIL VIEW (occupied table) ========
  if (view === 'order_detail' && activeOrder) {
    const activeItems = activeOrder.items.filter(i => !i.is_cancelled)
    const cancelledItems = activeOrder.items.filter(i => i.is_cancelled)
    const orderTotal = activeItems.reduce((sum, i) => sum + i.total_price, 0)

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-800 flex flex-col">
        <header className="bg-white dark:bg-neutral-800 border-b dark:border-neutral-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => { setView('tables'); setActiveOrder(null) }}
            className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-500 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">
              {selectedTable ? getTableDisplayName(selectedTable) : 'Table'} — {activeOrder.order_number}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                activeOrder.status === 'ready' ? 'bg-green-100 text-green-700' :
                activeOrder.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                activeOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400'
              }`}>
                {activeOrder.status}
              </span>
              {activeOrder.created_at && (
                <span className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(activeOrder.created_at)}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 space-y-4">
          {/* Current items */}
          <div className="bg-white dark:bg-neutral-800 dark:border dark:border-neutral-600 rounded-xl p-4 space-y-2.5">
            <h3 className="font-bold text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wide">Current Items</h3>
            {activeItems.map(item => (
              <div key={item.id} className="flex justify-between items-start py-1">
                <span className="flex items-start gap-2 flex-1 min-w-0 mr-2">
                  <span className={`h-3 w-3 rounded-sm border mt-0.5 flex items-center justify-center shrink-0 ${
                    item.menu_item?.is_veg ? 'border-green-600' : 'border-red-600'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      item.menu_item?.is_veg ? 'bg-green-600' : 'bg-red-600'
                    }`} />
                  </span>
                  <span className="text-sm leading-snug">{item.quantity}x {item.menu_item?.name}</span>
                </span>
                <span className="text-sm font-semibold shrink-0">₹{Math.round(item.total_price)}</span>
              </div>
            ))}
            {cancelledItems.length > 0 && (
              <>
                <Separator />
                {cancelledItems.map(item => (
                  <div key={item.id} className="flex justify-between text-xs text-gray-400 dark:text-neutral-500 line-through py-0.5">
                    <span>{item.quantity}x {item.menu_item?.name}</span>
                    <span>₹{Math.round(item.total_price)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="pt-3 border-t dark:border-neutral-600 flex justify-between items-center">
              <span className="font-bold text-base">Total</span>
              <span className="font-bold text-lg text-amber-700">₹{Math.round(orderTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {activeOrder.status !== 'completed' && (
              <Button
                className="w-full h-14 bg-amber-700 hover:bg-amber-800 text-base font-bold rounded-xl"
                onClick={startAddItems}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add More Items
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() => setTransferDialogOpen(true)}
            >
              <ArrowRightLeft className="h-5 w-5 mr-2" />
              Transfer Table
            </Button>
          </div>
        </div>

        {/* Table Transfer Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Transfer to Table</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {groupTablesByDisplayGroup(tables.filter(t => t.status === 'available')).map(group => (
                <div key={group.group}>
                  <p className="text-sm font-medium text-gray-500 dark:text-neutral-400 mb-2">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.tables.map(table => (
                      <button
                        key={table.id}
                        onClick={() => transferTable(table)}
                        disabled={transferring}
                        className="p-2.5 rounded-xl text-center border-2 border-green-300 bg-green-50 dark:bg-green-900/30 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all active:scale-95"
                      >
                        <p className="text-sm font-bold">{getTableDisplayName(table)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {tables.filter(t => t.status === 'available').length === 0 && (
                <p className="text-center text-gray-400 dark:text-neutral-500 py-4">No available tables</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ======== CATEGORIES VIEW ========
  if (view === 'categories') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-800 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-neutral-800 border-b dark:border-neutral-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => {
              if (addingToOrder) {
                setView('order_detail')
              } else {
                setView('tables')
                setCart([])
              }
            }}
            className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-500 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">
              {addingToOrder
                ? `Add to ${addingToOrder.order_number}`
                : selectedTable ? getTableDisplayName(selectedTable) : 'Takeaway'}
            </p>
            {addingToOrder && (
              <p className="text-xs text-amber-600 font-medium mt-0.5">Adding items to existing order</p>
            )}
            {!addingToOrder && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Select a category</p>
            )}
          </div>
        </header>

        {/* Search */}
        <div className="px-4 py-3 bg-white dark:bg-neutral-800 border-b dark:border-neutral-600">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value.length > 0) {
                  setActiveCategory('all')
                  setView('menu')
                }
              }}
              className="pl-9 pr-8 h-11 rounded-xl dark:bg-neutral-700 dark:border-neutral-500 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Category cards */}
        <div className="flex-1 p-4 pb-28">
          <div className="grid grid-cols-2 gap-3">
            {/* All Items card */}
            <button
              onClick={() => selectCategory('all')}
              className="bg-amber-700 text-white rounded-xl p-4 text-left shadow-sm active:scale-95 transition-transform min-h-[96px]"
            >
              <LayoutGrid className="h-6 w-6 mb-2 opacity-80" />
              <h3 className="font-bold text-base">All Items</h3>
              <p className="text-xs text-amber-200 mt-1">{menuItems.length} items</p>
            </button>

            {/* Category cards */}
            {categories.map(cat => {
              const count = categoryItemCounts.get(cat.id) || 0
              if (count === 0) return null
              return (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className="bg-white dark:bg-neutral-800 rounded-xl p-4 text-left shadow-sm border border-gray-100 dark:border-neutral-700 active:scale-95 transition-transform hover:border-amber-200 min-h-[96px]"
                >
                  <UtensilsCrossed className="h-5 w-5 mb-2 text-amber-700" />
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2">{cat.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">{count} items</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cart footer */}
        {cartFooter}
        {confirmDialog}
      </div>
    )
  }

  // ======== MENU VIEW ========
  const activeCategoryName = activeCategory === 'all'
    ? 'All Items'
    : categories.find(c => c.id === activeCategory)?.name || 'Menu'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-800 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800 border-b dark:border-neutral-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => {
            setView('categories')
            setSearchQuery('')
          }}
          className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-500 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate">
            {addingToOrder
              ? `Add to ${addingToOrder.order_number}`
              : selectedTable ? getTableDisplayName(selectedTable) : 'Takeaway'}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{activeCategoryName}</p>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-2.5 bg-white dark:bg-neutral-800 border-b dark:border-neutral-600">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-10 rounded-xl dark:bg-neutral-700 dark:border-neutral-500 dark:text-neutral-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category chips for quick switching */}
      <div className="px-3 py-2.5 bg-white dark:bg-neutral-800 border-b dark:border-neutral-600 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === 'all' ? 'bg-amber-700 text-white' : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id ? 'bg-amber-700 text-white' : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 p-3 pb-28">
        {filteredItems.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No items found</p>
            {searchQuery && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {filteredItems.map(item => {
            const inCart = cart.find(c => c.menu_item.id === item.id)
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className={`bg-white dark:bg-neutral-800 rounded-xl p-3 text-left shadow-sm border-2 active:scale-95 transition-all min-h-[90px] ${
                  inCart ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/30' : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1">
                    {item.is_veg ? (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-green-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                      </span>
                    ) : (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      </span>
                    )}
                  </span>
                  {inCart && (
                    <span className="text-xs bg-amber-700 text-white min-w-[22px] h-[22px] flex items-center justify-center rounded-full font-bold">
                      {inCart.quantity}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-sm leading-snug line-clamp-2">{item.name}</h3>
                <p className="text-amber-700 font-bold text-sm mt-1.5">₹{Math.round(item.price)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Cart Footer + Confirm Dialog */}
      {cartFooter}
      {confirmDialog}
    </div>
  )
}
