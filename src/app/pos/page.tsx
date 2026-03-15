'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Category, MenuItem, CartItem, Table as TableType, StationType, Profile } from '@/types/database'
import { STATIONS } from '@/lib/constants'
import { getTableDisplayName, groupTablesByDisplayGroup } from '@/lib/utils/table-display'
import { printKOT } from '@/lib/utils/print'
import { usePrintStatus } from '@/hooks/use-print-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Trash2,
  ShoppingCart,
  Coffee,
  Leaf,
  CircleDot,
  LogOut,
  Settings,
  X,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  UtensilsCrossed,
  Receipt,
  ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { BillingDialog } from '@/components/pos/billing-dialog'
import { OrdersPanel } from '@/components/pos/orders-panel'

export default function POSPage() {
  const { profile, isLoading, signOut } = useAuth(['admin', 'manager', 'cashier'])
  const printStatus = usePrintStatus()
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<TableType[]>([])
  const [waiters, setWaiters] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // POS State
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [menuView, setMenuView] = useState<'categories' | 'items'>('categories')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in')
  const [orderNotes, setOrderNotes] = useState('')

  // Table selection dialog
  const [tableDialogOpen, setTableDialogOpen] = useState(false)

  // Billing
  const [posMode, setPosMode] = useState<'menu' | 'orders'>('menu')
  const [billingOrder, setBillingOrder] = useState<any>(null)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)

  // Adding items to existing order
  const [addingToOrder, setAddingToOrder] = useState<any>(null)

  // Order placement guard — prevents double-submit
  const [placing, setPlacing] = useState(false)
  const placingRef = useRef(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [catResult, itemResult, tableResult, waiterResult] = await Promise.all([
      supabase.from('categories').select('id, name, display_order, is_active').eq('is_active', true).order('display_order'),
      supabase.from('menu_items').select('id, name, price, category_id, station, is_veg, is_active, category:categories(id, name), variants:item_variants(id, name, price_adjustment)').eq('is_active', true).order('name'),
      supabase.from('tables').select('id, number, section, capacity, status, current_order_id').order('section').order('number'),
      supabase.from('profiles').select('id, name, role, phone, is_active').eq('is_active', true).in('role', ['waiter', 'cashier', 'manager', 'admin']).order('name'),
    ])

    if (catResult.data) setCategories(catResult.data as unknown as Category[])
    if (itemResult.data) setMenuItems(itemResult.data as unknown as MenuItem[])
    if (tableResult.data) setTables(tableResult.data as unknown as TableType[])
    if (waiterResult.data) setWaiters(waiterResult.data as unknown as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Cart operations
  function addToCart(item: MenuItem) {
    const existingIndex = cart.findIndex(
      (c) => c.menu_item.id === item.id && !c.variant
    )

    if (existingIndex >= 0) {
      const updated = [...cart]
      updated[existingIndex].quantity += 1
      updated[existingIndex].total_price =
        updated[existingIndex].unit_price * updated[existingIndex].quantity
      setCart(updated)
    } else {
      setCart([
        ...cart,
        {
          menu_item: item,
          variant: null,
          addons: [],
          quantity: 1,
          notes: '',
          unit_price: item.price,
          total_price: item.price,
        },
      ])
    }
  }

  function updateQuantity(index: number, delta: number) {
    const updated = [...cart]
    updated[index].quantity += delta
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1)
    } else {
      updated[index].total_price =
        updated[index].unit_price * updated[index].quantity
    }
    setCart(updated)
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index))
  }

  function clearCart() {
    setCart([])
    setSelectedTable('')
    setOrderNotes('')
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  // Place order (or add items to existing order)
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
      let tableNum: number | null = selectedTableObj?.number || null
      let tableSec: string | null = selectedTableObj?.section || null
      let currentOrderType = orderType

      if (addingToOrder) {
        // Adding items to existing order
        orderId = addingToOrder.id
        orderNumber = addingToOrder.order_number
        tableNum = addingToOrder.table?.number || null
        tableSec = addingToOrder.table?.section || null
        currentOrderType = addingToOrder.order_type
      } else {
        // Creating new order
        if (orderType === 'dine_in' && !selectedTable) {
          toast.error('Please select a table for dine-in orders')
          setTableDialogOpen(true)
          return
        }

        const { data: orderNum } = await supabase.rpc('generate_order_number')
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: orderType === 'dine_in' ? selectedTable : null,
            order_number: orderNum || `ORD-${Date.now()}`,
            status: 'pending',
            order_type: orderType,
            waiter_id: profile?.id || null,
            notes: orderNotes || null,
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

      // Create order items
      const orderItems = cart.map((item) => ({
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

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        toast.error('Failed to add order items')
        return
      }

      // Create KOT entries grouped by station
      const stationGroups = new Map<StationType, typeof orderItems>()
      orderItems.forEach((item) => {
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
          orderNotes || undefined,
          profile?.name || null,
        ).catch(() => {
          toast.error(`KOT print failed for ${station} - check printer`)
        })
      }

      // Update table status if new dine-in order
      if (!addingToOrder && orderType === 'dine_in' && selectedTable) {
        await supabase
          .from('tables')
          .update({ status: 'occupied', current_order_id: orderId })
          .eq('id', selectedTable)
      }

      const action = addingToOrder ? 'Items added to' : 'Order'
      toast.success(`${action} ${orderNumber}!`)
      setAddingToOrder(null)
      clearCart()
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to place order')
    } finally {
      placingRef.current = false
      setPlacing(false)
    }
  }

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const selectedTableObj = tables.find((t) => t.id === selectedTable)

  // Category item counts for cards
  const categoryItemCounts = new Map<string, number>()
  menuItems.forEach(item => {
    categoryItemCounts.set(item.category_id, (categoryItemCounts.get(item.category_id) || 0) + 1)
  })

  function selectCategory(catId: string) {
    setActiveCategory(catId)
    setMenuView('items')
    setSearchQuery('')
  }

  const activeCategoryName = activeCategory === 'all'
    ? 'All Items'
    : categories.find(c => c.id === activeCategory)?.name || ''

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Panel: Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <Coffee className="h-6 w-6 text-amber-700" />
            <h1 className="font-semibold text-lg hidden sm:block">Le Vantage Cafe</h1>
            <span
              className={`h-2 w-2 rounded-full ${
                printStatus ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={printStatus ? 'Print proxy connected' : 'Print proxy offline'}
            />
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPosMode('menu')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                posMode === 'menu' ? 'bg-white shadow text-amber-700' : 'text-gray-500'
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Menu
            </button>
            <button
              onClick={() => setPosMode('orders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                posMode === 'orders' ? 'bg-white shadow text-amber-700' : 'text-gray-500'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Orders
            </button>
          </div>

          {/* Search - only when viewing items */}
          {posMode === 'menu' && menuView === 'items' && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {(posMode === 'orders' || (posMode === 'menu' && menuView === 'categories')) && <div className="w-64" />}

          <div className="flex items-center gap-2">
            <a href="/cashier">
              <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50">
                Cashier
              </Button>
            </a>
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <a href="/admin">
                <Button variant="ghost" size="sm">Admin</Button>
              </a>
            )}
            <span className="text-sm text-gray-500 hidden sm:block">{profile?.name}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Category Cards / Items View - Menu mode */}
        {posMode === 'menu' ? (
          menuView === 'categories' ? (
          /* ---- Category Cards Grid ---- */
          <ScrollArea className="flex-1 p-4" style={{ minHeight: 0 }}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {/* All Items card */}
              <button
                onClick={() => selectCategory('all')}
                className="bg-amber-700 text-white rounded-xl p-4 text-left shadow-sm active:scale-95 transition-transform hover:bg-amber-800"
              >
                <LayoutGrid className="h-6 w-6 mb-2 opacity-80" />
                <h3 className="font-semibold text-sm">All Items</h3>
                <p className="text-xs text-amber-100 mt-1">{menuItems.length} items</p>
              </button>

              {categories.map(cat => {
                const count = categoryItemCounts.get(cat.id) || 0
                if (count === 0) return null
                return (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat.id)}
                    className="bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100 active:scale-95 transition-transform hover:border-amber-200 hover:shadow-md"
                  >
                    <UtensilsCrossed className="h-5 w-5 mb-2 text-amber-700" />
                    <h3 className="font-semibold text-sm line-clamp-2">{cat.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{count} items</p>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
          ) : (
          /* ---- Items Grid (after category selected) ---- */
          <>
            <div className="bg-white border-b px-4 py-2 flex items-center gap-3" style={{ flexShrink: 0 }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setMenuView('categories'); setSearchQuery('') }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold text-sm">{activeCategoryName}</h2>
              <span className="text-xs text-gray-400">({filteredItems.length} items)</span>
            </div>
            <ScrollArea className="flex-1 p-4" style={{ minHeight: 0 }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredItems.map((item) => {
                  const inCart = cart.find(c => c.menu_item.id === item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`bg-white rounded-xl p-3 text-left shadow-sm border active:scale-95 transition-all hover:shadow-md ${
                        inCart ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-100 hover:border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          {item.is_veg ? (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-green-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                            </span>
                          ) : (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-red-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 uppercase">
                            {STATIONS.find(s => s.value === item.station)?.label?.split(' ')[0]}
                          </span>
                        </span>
                        {inCart && (
                          <span className="text-[10px] bg-amber-700 text-white px-1.5 py-0.5 rounded-full font-semibold">
                            {inCart.quantity}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-sm leading-tight mb-1 line-clamp-2">
                        {item.name}
                      </h3>
                      <p className="text-amber-700 font-bold text-sm">₹{item.price}</p>
                    </button>
                  )
                })}
              </div>
              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No items found</p>
                  {searchQuery && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>
          </>
          )
        ) : (
        /* Orders Panel - Orders mode */
        <div className="flex-1 overflow-hidden">
          <OrdersPanel
            onSettleBill={(order) => {
              setBillingOrder(order)
              setBillingDialogOpen(true)
            }}
          />
        </div>
        )}
      </div>

      {/* Right Panel: Cart (Desktop) */}
      <div className="hidden lg:flex w-96 flex-col bg-white border-l">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {addingToOrder ? `Add to ${addingToOrder.order_number}` : 'Order'}
            </h2>
            <div className="flex gap-1">
              {addingToOrder && (
                <Button variant="ghost" size="sm" onClick={() => { setAddingToOrder(null); clearCart() }} className="text-gray-500 h-8">
                  Cancel
                </Button>
              )}
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-500 h-8">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Order type & Table */}
          <div className="flex gap-2 mb-2">
            <Button
              variant={orderType === 'dine_in' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setOrderType('dine_in')}
            >
              Dine In
            </Button>
            <Button
              variant={orderType === 'takeaway' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => { setOrderType('takeaway'); setSelectedTable('') }}
            >
              Takeaway
            </Button>
          </div>

          {orderType === 'dine_in' && (
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setTableDialogOpen(true)}
            >
              {selectedTableObj ? (
                <span>{getTableDisplayName(selectedTableObj)}</span>
              ) : (
                <span className="text-gray-400">Select Table</span>
              )}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4" style={{ minHeight: 0 }}>
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tap items to add to order</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.menu_item.name}</p>
                    <p className="text-xs text-gray-500">₹{item.unit_price} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-semibold w-6 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold w-16 text-right">
                    ₹{item.total_price}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400"
                    onClick={() => removeFromCart(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal ({itemCount} items)</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full h-12 text-base bg-amber-700 hover:bg-amber-800"
              onClick={placeOrder}
              disabled={placing}
            >
              {placing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                addingToOrder ? `Add Items - ₹${subtotal.toFixed(2)}` : `Place Order - ₹${subtotal.toFixed(2)}`
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Cart Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        {cart.length > 0 && (
          <Sheet>
            <SheetTrigger
              render={<Button className="h-14 px-6 rounded-full bg-amber-700 hover:bg-amber-800 shadow-lg" />}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {itemCount} items - ₹{subtotal.toFixed(2)}
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>Order ({itemCount} items)</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[50vh]">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.menu_item.name}</p>
                      <p className="text-xs text-gray-500">₹{item.unit_price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => updateQuantity(index, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => updateQuantity(index, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold">₹{item.total_price}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{subtotal.toFixed(2)}</span>
                </div>
                <Button className="w-full h-12 bg-amber-700 hover:bg-amber-800" onClick={placeOrder} disabled={placing}>
                  {placing ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    `Place Order - ₹${subtotal.toFixed(2)}`
                  )}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Table Selection Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {groupTablesByDisplayGroup(tables).map(group => (
              <div key={group.group}>
                <p className="text-sm font-medium text-gray-500 mb-2">{group.label}</p>
                <div className="grid grid-cols-5 gap-2">
                  {group.tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={async () => {
                        if (table.status === 'occupied' && table.current_order_id) {
                          // Occupied table — check if bill was already printed or order completed
                          const supabase = createClient()
                          const { data: orderData } = await supabase
                            .from('orders')
                            .select(`
                              id, order_number, status, order_type, created_at, table_id, notes, bill_print_count,
                              table:tables!table_id(number, section),
                              items:order_items(
                                id, quantity, unit_price, total_price, notes, station, is_cancelled, kot_status,
                                menu_item:menu_items(name, is_veg)
                              ),
                              bill:bills(id)
                            `)
                            .eq('id', table.current_order_id)
                            .single()

                          const billPrinted = (orderData as any)?.bill_print_count > 0
                          const billExists = orderData && (Array.isArray((orderData as any).bill) ? (orderData as any).bill.length > 0 : !!(orderData as any).bill)
                          const orderCompleted = orderData?.status === 'completed'

                          if (orderData && (billPrinted || billExists || orderCompleted)) {
                            // Bill printed/exists or order completed — reuse table for new order
                            // Ensure old order has bill_print_count >= 1 for Pending Settlement tracking
                            if (!billPrinted) {
                              supabase.from('orders')
                                .update({ bill_print_count: 1 })
                                .eq('id', orderData.id)
                                .then(() => {})
                            }
                            setSelectedTable(table.id)
                            setAddingToOrder(null)
                            setTableDialogOpen(false)
                            toast.success(`${getTableDisplayName(table)} selected for new order`)
                          } else if (orderData) {
                            setAddingToOrder(orderData)
                            setSelectedTable(table.id)
                            setTableDialogOpen(false)
                            setPosMode('menu')
                            toast.info(`Adding items to ${orderData.order_number} (${getTableDisplayName(table)})`)
                          } else {
                            // Order not found — table is stale, allow new order
                            setSelectedTable(table.id)
                            setAddingToOrder(null)
                            setTableDialogOpen(false)
                          }
                        } else {
                          // Available table — new order
                          setSelectedTable(table.id)
                          setAddingToOrder(null)
                          setTableDialogOpen(false)
                        }
                      }}
                      className={`p-2 rounded-lg text-center border-2 transition-all ${
                        table.id === selectedTable
                          ? 'border-amber-700 bg-amber-50 text-amber-900'
                          : table.status === 'occupied'
                          ? 'border-green-200 bg-green-50 text-green-700 hover:border-green-400 cursor-pointer'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <p className="text-sm font-bold">{getTableDisplayName(table)}</p>
                      <p className="text-[10px] capitalize">
                        {table.status === 'occupied' ? 'running' : table.status}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Billing Dialog */}
      <BillingDialog
        order={billingOrder}
        open={billingDialogOpen}
        onClose={() => { setBillingDialogOpen(false); setBillingOrder(null) }}
        onBillSettled={loadData}
        onAddItems={(order) => {
          setAddingToOrder(order)
          setPosMode('menu')
        }}
        tables={tables}
        waiters={waiters}
      />
    </div>
  )
}
