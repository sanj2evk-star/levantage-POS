'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bill, Order, Payment, Table } from '@/types/database'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Trash2,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  ShoppingCart,
  Search,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react'

interface BillOrder {
  id: string
  order_number: string
  order_type: string
  status: string
  notes: string | null
  created_at: string
  table?: { number: number; section: string } | null
  items?: {
    id: string
    quantity: number
    unit_price: number
    total_price: number
    is_cancelled: boolean
    menu_item?: { name: string } | null
  }[]
}

interface BillWithDetails extends Omit<Bill, 'order'> {
  payments?: Payment[]
  order?: BillOrder
}

interface OrderWithDetails extends Omit<Order, 'table' | 'items' | 'bill'> {
  table?: Table | null
  items?: {
    id: string
    quantity: number
    unit_price: number
    total_price: number
    is_cancelled: boolean
    menu_item?: { name: string } | null
  }[]
  bill?: Bill | null
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmtTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const fmtCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

import { getTableDisplayName } from '@/lib/utils/table-display'

export default function DataManagementPage() {
  const { profile } = useAuth(['admin'])
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [activeTab, setActiveTab] = useState<'bills' | 'orders' | 'bulk'>('bills')
  const [bills, setBills] = useState<BillWithDetails[]>([])
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set())
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Bulk delete state
  const [bulkFromDate, setBulkFromDate] = useState('')
  const [bulkToDate, setBulkToDate] = useState('')
  const [bulkPaymentMode, setBulkPaymentMode] = useState<string>('all')
  const [bulkBills, setBulkBills] = useState<{ id: string; bill_number: string; total: number; payment_mode: string; order_id: string | null; created_at: string; order?: { order_number?: string; table?: { number: number; section: string } | null } }[]>([])
  const [selectedBulkBills, setSelectedBulkBills] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Date navigation
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(fmtDate(d))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setSelectedBills(new Set())
    setSelectedOrders(new Set())
    const supabase = createClient()

    const localStart = new Date(selectedDate + 'T00:00:00')
    const localEnd = new Date(selectedDate + 'T23:59:59')
    const startISO = localStart.toISOString()
    const endISO = localEnd.toISOString()

    const [billsResult, ordersResult] = await Promise.all([
      supabase
        .from('bills')
        .select('*, payments(*), order:orders!order_id(id, order_number, order_type, status, notes, created_at, table:tables!table_id(number, section), items:order_items(id, quantity, unit_price, total_price, is_cancelled, menu_item:menu_items!menu_item_id(name)))')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, table:tables!table_id(number, section), items:order_items(id, quantity, unit_price, total_price, is_cancelled, menu_item:menu_items!menu_item_id(name)), bill:bills!order_id(*)')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false }),
    ])

    setBills((billsResult.data || []) as unknown as BillWithDetails[])
    setOrders((ordersResult.data || []) as unknown as OrderWithDetails[])
    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Delete individual bill and its associated order
  async function deleteBills(billIds: string[]) {
    setDeleting(true)
    const supabase = createClient()

    for (const billId of billIds) {
      const bill = bills.find(b => b.id === billId)
      if (!bill) continue

      // Delete audit_logs referencing this bill or its order
      if (bill.order?.id) {
        await supabase.from('audit_logs').delete().eq('order_id', bill.order.id)
      }
      await supabase.from('audit_logs').delete().eq('bill_id', billId)

      // Delete payments for this bill
      await supabase.from('payments').delete().eq('bill_id', billId)
      // Delete the bill
      await supabase.from('bills').delete().eq('id', billId)

      // Delete the associated order and its items
      if (bill.order?.id) {
        const orderId = bill.order.id
        // Get order item IDs for addon deletion
        const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
        const itemIds = items?.map(i => i.id) || []
        if (itemIds.length > 0) {
          await supabase.from('order_item_addons').delete().in('order_item_id', itemIds)
        }
        await supabase.from('order_items').delete().eq('order_id', orderId)
        await supabase.from('kot_entries').delete().eq('order_id', orderId)
        await supabase.from('orders').delete().eq('id', orderId)

        // Reset table status if occupied by this order
        await supabase.from('tables').update({ status: 'available', current_order_id: null }).eq('current_order_id', orderId)
      }
    }

    toast.success(`Deleted ${billIds.length} bill${billIds.length > 1 ? 's' : ''} and associated data`)
    setDeleting(false)
    setDeleteDialogOpen(false)
    setSelectedBills(new Set())
    loadData()
  }

  // Delete individual orders (without bills)
  async function deleteOrders(orderIds: string[]) {
    setDeleting(true)
    const supabase = createClient()

    for (const orderId of orderIds) {
      // Delete audit_logs referencing this order or its bills
      await supabase.from('audit_logs').delete().eq('order_id', orderId)

      // Delete associated bill if exists
      const { data: billData } = await supabase.from('bills').select('id').eq('order_id', orderId)
      if (billData && billData.length > 0) {
        for (const b of billData) {
          await supabase.from('audit_logs').delete().eq('bill_id', b.id)
          await supabase.from('payments').delete().eq('bill_id', b.id)
        }
        await supabase.from('bills').delete().eq('order_id', orderId)
      }

      // Get order item IDs
      const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
      const itemIds = items?.map(i => i.id) || []
      if (itemIds.length > 0) {
        await supabase.from('order_item_addons').delete().in('order_item_id', itemIds)
      }
      await supabase.from('order_items').delete().eq('order_id', orderId)
      await supabase.from('kot_entries').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)

      // Reset table
      await supabase.from('tables').update({ status: 'available', current_order_id: null }).eq('current_order_id', orderId)
    }

    toast.success(`Deleted ${orderIds.length} order${orderIds.length > 1 ? 's' : ''} and associated data`)
    setDeleting(false)
    setDeleteDialogOpen(false)
    setSelectedOrders(new Set())
    loadData()
  }

  // Bulk delete preview - fetches bills with details
  async function previewBulkDelete() {
    if (!bulkFromDate || !bulkToDate) {
      toast.error('Select both from and to dates')
      return
    }
    setBulkLoading(true)
    setBulkBills([])
    setSelectedBulkBills(new Set())
    const supabase = createClient()

    const startISO = new Date(bulkFromDate + 'T00:00:00').toISOString()
    const endISO = new Date(bulkToDate + 'T23:59:59').toISOString()

    let query = supabase
      .from('bills')
      .select('id, bill_number, total, payment_mode, order_id, created_at, order:orders!order_id(order_number, table:tables!table_id(number, section))')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })

    if (bulkPaymentMode !== 'all') {
      query = query.eq('payment_mode', bulkPaymentMode)
    }

    const { data: matchingBills } = await query

    setBulkBills((matchingBills || []) as typeof bulkBills)
    // Auto-select all
    setSelectedBulkBills(new Set((matchingBills || []).map((b: { id: string }) => b.id)))
    setBulkLoading(false)
  }

  // Bulk delete execution - only deletes selected bills
  async function executeBulkDelete() {
    const billIds = Array.from(selectedBulkBills)
    if (billIds.length === 0) {
      toast.error('No bills selected')
      return
    }

    setBulkDeleting(true)
    const supabase = createClient()

    const selectedBillData = bulkBills.filter(b => selectedBulkBills.has(b.id))
    const orderIds = selectedBillData.map(b => b.order_id).filter(Boolean) as string[]

    // Delete audit_logs for bills and orders
    for (let i = 0; i < billIds.length; i += 50) {
      const batch = billIds.slice(i, i + 50)
      await supabase.from('audit_logs').delete().in('bill_id', batch)
    }
    if (orderIds.length > 0) {
      for (let i = 0; i < orderIds.length; i += 50) {
        const batch = orderIds.slice(i, i + 50)
        await supabase.from('audit_logs').delete().in('order_id', batch)
      }
    }

    // Delete payments
    for (let i = 0; i < billIds.length; i += 50) {
      const batch = billIds.slice(i, i + 50)
      await supabase.from('payments').delete().in('bill_id', batch)
      await supabase.from('bills').delete().in('id', batch)
    }

    // Delete associated orders and their items
    if (orderIds.length > 0) {
      for (let i = 0; i < orderIds.length; i += 50) {
        const batch = orderIds.slice(i, i + 50)
        const { data: items } = await supabase.from('order_items').select('id').in('order_id', batch)
        const itemIds = items?.map(it => it.id) || []
        if (itemIds.length > 0) {
          await supabase.from('order_item_addons').delete().in('order_item_id', itemIds)
        }
        await supabase.from('order_items').delete().in('order_id', batch)
        await supabase.from('kot_entries').delete().in('order_id', batch)
        await supabase.from('orders').delete().in('id', batch)
      }

      await supabase.from('tables').update({ status: 'available', current_order_id: null }).in('current_order_id', orderIds)
    }

    toast.success(`Bulk deleted ${billIds.length} bills and associated data`)
    setBulkDeleting(false)
    setBulkDeleteDialogOpen(false)
    setBulkBills([])
    setSelectedBulkBills(new Set())
    loadData()
  }

  // Bulk bill selection toggles
  const toggleBulkBill = (id: string) => {
    setSelectedBulkBills(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllBulkBills = () => {
    if (selectedBulkBills.size === bulkBills.length) {
      setSelectedBulkBills(new Set())
    } else {
      setSelectedBulkBills(new Set(bulkBills.map(b => b.id)))
    }
  }

  // Toggle selection
  const toggleBill = (id: string) => {
    setSelectedBills(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllBills = () => {
    if (selectedBills.size === filteredBills.length) {
      setSelectedBills(new Set())
    } else {
      setSelectedBills(new Set(filteredBills.map(b => b.id)))
    }
  }

  const toggleAllOrders = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
    }
  }

  // Filtered lists
  const filteredBills = bills.filter(b => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const billNum = b.bill_number?.toLowerCase() || ''
    const orderNum = b.order?.order_number?.toLowerCase() || ''
    const tableNum = b.order?.table ? getTableDisplayName(b.order.table).toLowerCase() : 'takeaway'
    return billNum.includes(q) || orderNum.includes(q) || tableNum.includes(q)
  })

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const orderNum = o.order_number?.toLowerCase() || ''
    const tableNum = o.table ? getTableDisplayName(o.table as { number: number; section: string }).toLowerCase() : 'takeaway'
    const status = o.status?.toLowerCase() || ''
    return orderNum.includes(q) || tableNum.includes(q) || status.includes(q)
  })

  // Summary for selected date
  const totalBillAmount = bills.reduce((sum, b) => sum + (b.total || 0), 0)
  const totalOrders = orders.length

  // What's being deleted
  const deleteCount = activeTab === 'bills' ? selectedBills.size : activeTab === 'orders' ? selectedOrders.size : 0
  const deleteLabel = activeTab === 'bills' ? 'bill' : 'order'

  if (!profile) return null

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Data Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44 pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(fmtDate(new Date()))}
            className={selectedDate === fmtDate(new Date()) ? 'bg-amber-50 border-amber-300' : ''}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total Bills</p>
            <p className="text-xl font-bold">{bills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total Orders</p>
            <p className="text-xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Total Sales</p>
            <p className="text-xl font-bold">{fmtCurrency(totalBillAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Selected</p>
            <p className="text-xl font-bold text-red-600">{deleteCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search + Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('bills'); setSearchQuery('') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'bills' ? 'bg-white shadow text-amber-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Receipt className="h-4 w-4" />
            Bills ({bills.length})
          </button>
          <button
            onClick={() => { setActiveTab('orders'); setSearchQuery('') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'orders' ? 'bg-white shadow text-amber-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Orders ({orders.length})
          </button>
          <button
            onClick={() => { setActiveTab('bulk'); setSearchQuery('') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'bulk' ? 'bg-white shadow text-red-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="h-4 w-4" />
            Bulk Delete
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={activeTab === 'bills' ? 'Search bill #, order #, table...' : 'Search order #, table, status...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {deleteCount > 0 && (
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({deleteCount})
          </Button>
        )}
      </div>

      {/* Bills Tab */}
      {activeTab === 'bills' && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-700" />
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No bills found for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left w-10">
                        <button onClick={toggleAllBills} className="text-gray-400 hover:text-gray-700">
                          {selectedBills.size === filteredBills.length && filteredBills.length > 0
                            ? <CheckSquare className="h-4 w-4" />
                            : <Square className="h-4 w-4" />
                          }
                        </button>
                      </th>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Bill No.</th>
                      <th className="p-3 text-left">Order</th>
                      <th className="p-3 text-left">Table</th>
                      <th className="p-3 text-left">Items</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Time</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill, idx) => {
                      const order = bill.order
                      const table = order?.table
                      const activeItems = order?.items?.filter(i => !i.is_cancelled) || []
                      const itemsSummary = activeItems.slice(0, 3).map(i =>
                        `${i.menu_item?.name || 'Item'} x${i.quantity}`
                      ).join(', ')
                      const moreItems = activeItems.length > 3 ? ` +${activeItems.length - 3} more` : ''

                      return (
                        <tr
                          key={bill.id}
                          className={`border-b hover:bg-gray-50 ${selectedBills.has(bill.id) ? 'bg-red-50' : ''}`}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedBills.has(bill.id)}
                              onCheckedChange={() => toggleBill(bill.id)}
                            />
                          </td>
                          <td className="p-3 text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-mono text-xs">{bill.bill_number}</td>
                          <td className="p-3 font-mono text-xs">{order?.order_number || '-'}</td>
                          <td className="p-3">
                            {table ? (
                              <Badge variant="outline" className="text-xs">
                                {getTableDisplayName(table)}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Takeaway</Badge>
                            )}
                          </td>
                          <td className="p-3 text-xs text-gray-600 max-w-[200px] truncate" title={itemsSummary + moreItems}>
                            {itemsSummary}{moreItems}
                          </td>
                          <td className="p-3 text-right font-medium">{fmtCurrency(bill.total)}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                bill.payment_mode === 'cash' ? 'border-green-300 text-green-700' :
                                bill.payment_mode === 'upi' ? 'border-blue-300 text-blue-700' :
                                bill.payment_mode === 'card' ? 'border-purple-300 text-purple-700' :
                                'border-gray-300'
                              }`}
                            >
                              {bill.payment_mode || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-gray-500">{fmtTime(bill.created_at)}</td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setSelectedBills(new Set([bill.id]))
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {filteredBills.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td colSpan={6} className="p-3 text-right">Total:</td>
                        <td className="p-3 text-right">
                          {fmtCurrency(filteredBills.reduce((s, b) => s + (b.total || 0), 0))}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-700" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No orders found for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left w-10">
                        <button onClick={toggleAllOrders} className="text-gray-400 hover:text-gray-700">
                          {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                            ? <CheckSquare className="h-4 w-4" />
                            : <Square className="h-4 w-4" />
                          }
                        </button>
                      </th>
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Order No.</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Table</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Items</th>
                      <th className="p-3 text-left">Billed</th>
                      <th className="p-3 text-left">Time</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, idx) => {
                      const table = order.table as { number: number; section: string } | null
                      const activeItems = order.items?.filter(i => !i.is_cancelled) || []
                      const itemsSummary = activeItems.slice(0, 3).map(i =>
                        `${i.menu_item?.name || 'Item'} x${i.quantity}`
                      ).join(', ')
                      const moreItems = activeItems.length > 3 ? ` +${activeItems.length - 3} more` : ''
                      const hasBill = !!(order.bill && (Array.isArray(order.bill) ? (order.bill as Bill[]).length > 0 : true))

                      const statusColor =
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'ready' ? 'bg-purple-100 text-purple-700' :
                        order.status === 'served' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-yellow-100 text-yellow-700'

                      return (
                        <tr
                          key={order.id}
                          className={`border-b hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-red-50' : ''}`}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={() => toggleOrder(order.id)}
                            />
                          </td>
                          <td className="p-3 text-gray-500">{idx + 1}</td>
                          <td className="p-3 font-mono text-xs">{order.order_number}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs capitalize">
                              {order.order_type?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {table ? (
                              <Badge variant="outline" className="text-xs">
                                {getTableDisplayName(table)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge className={`text-xs capitalize ${statusColor}`}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-gray-600 max-w-[200px] truncate" title={itemsSummary + moreItems}>
                            {itemsSummary || 'No items'}{moreItems}
                          </td>
                          <td className="p-3">
                            {hasBill ? (
                              <Badge className="text-xs bg-green-100 text-green-700">Yes</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-400">No</Badge>
                            )}
                          </td>
                          <td className="p-3 text-xs text-gray-500">{fmtTime(order.created_at)}</td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setSelectedOrders(new Set([order.id]))
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Delete Tab */}
      {activeTab === 'bulk' && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <Zap className="h-4 w-4" />
              Bulk Delete by Date Range & Payment Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={bulkFromDate}
                  onChange={(e) => { setBulkFromDate(e.target.value); setBulkBills([]); setSelectedBulkBills(new Set()) }}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={bulkToDate}
                  onChange={(e) => { setBulkToDate(e.target.value); setBulkBills([]); setSelectedBulkBills(new Set()) }}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={bulkPaymentMode} onValueChange={(v) => { setBulkPaymentMode(v || 'all'); setBulkBills([]); setSelectedBulkBills(new Set()) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="cash">Cash Only</SelectItem>
                    <SelectItem value="upi">UPI Only</SelectItem>
                    <SelectItem value="card">Card Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={previewBulkDelete}
                disabled={!bulkFromDate || !bulkToDate || bulkLoading}
              >
                {bulkLoading ? 'Loading...' : 'Load Bills'}
              </Button>

              {bulkBills.length > 0 && selectedBulkBills.size > 0 && (
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedBulkBills.size})
                </Button>
              )}
            </div>

            {/* Bills table with checkboxes */}
            {bulkBills.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-red-700">
                    Found {bulkBills.length} bills — {selectedBulkBills.size} selected
                    ({fmtCurrency(bulkBills.filter(b => selectedBulkBills.has(b.id)).reduce((s, b) => s + Number(b.total), 0))})
                  </p>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-gray-50">
                        <th className="p-2 text-left w-10">
                          <button onClick={toggleAllBulkBills} className="text-gray-400 hover:text-gray-700">
                            {selectedBulkBills.size === bulkBills.length && bulkBills.length > 0
                              ? <CheckSquare className="h-4 w-4" />
                              : <Square className="h-4 w-4" />
                            }
                          </button>
                        </th>
                        <th className="p-2 text-left">Bill No.</th>
                        <th className="p-2 text-left">Order</th>
                        <th className="p-2 text-left">Table</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-left">Payment</th>
                        <th className="p-2 text-left">Date/Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkBills.map((bill) => {
                        const order = bill.order as { order_number?: string; table?: { number: number; section: string } | null } | null
                        const table = order?.table
                        return (
                          <tr
                            key={bill.id}
                            className={`border-b hover:bg-gray-50 ${selectedBulkBills.has(bill.id) ? 'bg-red-50' : ''}`}
                          >
                            <td className="p-2">
                              <Checkbox
                                checked={selectedBulkBills.has(bill.id)}
                                onCheckedChange={() => toggleBulkBill(bill.id)}
                              />
                            </td>
                            <td className="p-2 font-mono text-xs">{bill.bill_number}</td>
                            <td className="p-2 font-mono text-xs">{order?.order_number || '-'}</td>
                            <td className="p-2">
                              {table ? (
                                <Badge variant="outline" className="text-xs">
                                  {getTableDisplayName(table)}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Takeaway</Badge>
                              )}
                            </td>
                            <td className="p-2 text-right font-medium">{fmtCurrency(Number(bill.total))}</td>
                            <td className="p-2">
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${
                                  bill.payment_mode === 'cash' ? 'border-green-300 text-green-700' :
                                  bill.payment_mode === 'upi' ? 'border-blue-300 text-blue-700' :
                                  bill.payment_mode === 'card' ? 'border-purple-300 text-purple-700' :
                                  'border-gray-300'
                                }`}
                              >
                                {bill.payment_mode || 'N/A'}
                              </Badge>
                            </td>
                            <td className="p-2 text-xs text-gray-500">
                              {new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {fmtTime(bill.created_at)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {bulkBills.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-medium">
                          <td colSpan={4} className="p-2 text-right">Selected Total:</td>
                          <td className="p-2 text-right">
                            {fmtCurrency(bulkBills.filter(b => selectedBulkBills.has(b.id)).reduce((s, b) => s + Number(b.total), 0))}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {bulkBills.length === 0 && !bulkLoading && bulkFromDate && bulkToDate && (
              <p className="text-sm text-gray-500">Click &quot;Load Bills&quot; to see matching bills</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Bulk Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will permanently delete the selected bills, their orders, items, payments, and KOTs. This cannot be undone.
            </p>
            <div className="bg-red-50 rounded-lg p-3 space-y-1 text-sm">
              <p className="font-medium text-red-700">
                {selectedBulkBills.size} bills — {fmtCurrency(bulkBills.filter(b => selectedBulkBills.has(b.id)).reduce((s, b) => s + Number(b.total), 0))}
              </p>
              <p className="text-red-600">{bulkFromDate} to {bulkToDate}</p>
              {bulkPaymentMode !== 'all' && (
                <p className="text-red-600">Payment mode: {bulkPaymentMode.toUpperCase()}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={bulkDeleting}
                onClick={executeBulkDelete}
              >
                {bulkDeleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will permanently delete the selected {deleteLabel}(s) and all associated data
              (items, payments, KOTs). This cannot be undone.
            </p>

            <div className="bg-red-50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-medium text-red-700">
                {deleteCount} {deleteLabel}{deleteCount > 1 ? 's' : ''} selected for deletion
              </p>
              {activeTab === 'bills' && (
                <div className="space-y-1 text-red-600">
                  {Array.from(selectedBills).slice(0, 5).map(id => {
                    const bill = bills.find(b => b.id === id)
                    return bill ? (
                      <p key={id} className="text-xs">
                        {bill.bill_number} — {fmtCurrency(bill.total)} — {bill.order?.table ? getTableDisplayName(bill.order.table) : 'Takeaway'}
                      </p>
                    ) : null
                  })}
                  {selectedBills.size > 5 && (
                    <p className="text-xs">...and {selectedBills.size - 5} more</p>
                  )}
                </div>
              )}
              {activeTab === 'orders' && (
                <div className="space-y-1 text-red-600">
                  {Array.from(selectedOrders).slice(0, 5).map(id => {
                    const order = orders.find(o => o.id === id)
                    const table = order?.table as { number: number; section: string } | null
                    return order ? (
                      <p key={id} className="text-xs">
                        {order.order_number} — {order.status} — {table ? getTableDisplayName(table) : 'Takeaway'}
                      </p>
                    ) : null
                  })}
                  {selectedOrders.size > 5 && (
                    <p className="text-xs">...and {selectedOrders.size - 5} more</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleting}
                onClick={() => {
                  if (activeTab === 'bills') {
                    deleteBills(Array.from(selectedBills))
                  } else {
                    deleteOrders(Array.from(selectedOrders))
                  }
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
