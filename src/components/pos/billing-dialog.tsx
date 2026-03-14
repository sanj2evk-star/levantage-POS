'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, Bill, Payment, PaymentMode, DiscountType, Table as TableType, Profile } from '@/types/database'
import { GST_PERCENT, SERVICE_CHARGE_PERCENT, PAYMENT_MODES } from '@/lib/constants'
import { getTableDisplayName, groupTablesByDisplayGroup } from '@/lib/utils/table-display'
import { printBill, openCashDrawer } from '@/lib/utils/print'
import { RefundDialog } from './refund-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Percent,
  Minus,
  Plus,
  Printer,
  Check,
  X,
  Trash2,
  Lock,
  AlertTriangle,
  ArrowRightLeft,
  UserRound,
  Clock,
  RotateCcw,
  Gift,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'

export interface OrderWithDetails extends Omit<Order, 'table' | 'items' | 'bill'> {
  table?: { number: number; section: string }
  items: (OrderItem & {
    menu_item: { name: string; is_veg: boolean }
  })[]
  bill?: Bill
}

interface BillingDialogProps {
  order: OrderWithDetails | null
  open: boolean
  onClose: () => void
  onBillSettled: () => void
  onAddItems?: (order: OrderWithDetails) => void
  tables?: TableType[]
  waiters?: Profile[]
}

export interface SplitPaymentEntry {
  mode: PaymentMode
  amount: string
  reference_number: string
}

export function BillingDialog({ order, open, onClose, onBillSettled, onAddItems, tables, waiters }: BillingDialogProps) {
  // Live timer for active time display
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(timer)
  }, [open])

  const [serviceChargeRemoved, setServiceChargeRemoved] = useState(order?.service_charge_removed ?? false)
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([])
  const [settling, setSettling] = useState(false)

  // Cash received / change calculation
  const [cashReceived, setCashReceived] = useState('')
  const [existingBill, setExistingBill] = useState<Bill | null>(null)

  // Payment reference number
  const [referenceNumber, setReferenceNumber] = useState('')
  const [requirePaymentRef, setRequirePaymentRef] = useState(false)

  // Discount authorization
  const [discountMaxPercent, setDiscountMaxPercent] = useState(100)
  const [discountPinDialogOpen, setDiscountPinDialogOpen] = useState(false)
  const [discountPin, setDiscountPin] = useState('')
  const [discountPinVerified, setDiscountPinVerified] = useState(false)
  const [discountPinVerifying, setDiscountPinVerifying] = useState(false)
  const [userProfile, setUserProfile] = useState<{ role: string; name: string } | null>(null)

  // NC (No Charge) state — inline authorization (no sub-dialog)
  const [ncReason, setNcReason] = useState('')
  const [ncPin, setNcPin] = useState('')
  const [ncVerifying, setNcVerifying] = useState(false)
  const [ncAuthorized, setNcAuthorized] = useState(false)

  // Cancel item state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelItemId, setCancelItemId] = useState<string>('')
  const [cancelItemName, setCancelItemName] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelPassword, setCancelPassword] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Reprint state
  const [reprintDialogOpen, setReprintDialogOpen] = useState(false)
  const [reprintPassword, setReprintPassword] = useState('')
  const [reprinting, setReprinting] = useState(false)

  // Service charge removal PIN state
  const [scPinDialogOpen, setScPinDialogOpen] = useState(false)
  const [scPin, setScPin] = useState('')
  const [scPinVerifying, setScPinVerifying] = useState(false)

  // Table transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  // Waiter reassignment state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  // Local items state to handle cancellation updates without stale data
  const [localItems, setLocalItems] = useState(order?.items || [])

  // Collect balance state (for partial bills)
  const [collectBalanceMode, setCollectBalanceMode] = useState(false)
  const [collectPaymentMode, setCollectPaymentMode] = useState<PaymentMode | 'split' | ''>('')
  const [collectReferenceNumber, setCollectReferenceNumber] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [collectSplitPayments, setCollectSplitPayments] = useState<SplitPaymentEntry[]>([])

  // Refund dialog state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)

  // Existing bill payments
  const [existingPayments, setExistingPayments] = useState<Payment[]>([])

  // Print preview state (must be before any early return)
  const [printing, setPrinting] = useState(false)

  // Fetch user role and settings on mount
  useEffect(() => {
    async function fetchConfig() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', user.id)
          .single()
        if (profile) setUserProfile(profile)
      }
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['cashier_discount_max_percent', 'require_payment_ref'])
      if (settings) {
        settings.forEach(s => {
          if (s.key === 'cashier_discount_max_percent') setDiscountMaxPercent(parseFloat(s.value))
          if (s.key === 'require_payment_ref') setRequirePaymentRef(s.value === 'true')
        })
      }
    }
    fetchConfig()
  }, [])

  // Reset state when order changes
  useEffect(() => {
    if (order) {
      setServiceChargeRemoved(order?.service_charge_removed ?? false)
      setDiscountType('none')
      setDiscountValue('')
      setDiscountReason('')
      setPaymentMode('')
      setSplitPayments([])
      setExistingBill(order.bill || null)
      setLocalItems(order.items)
      setDiscountPinVerified(false)
      setDiscountPin('')
      setReferenceNumber('')
      setCashReceived('')
      setNcReason('')
      setNcPin('')
      setNcAuthorized(false)
      setCollectBalanceMode(false)
      setCollectPaymentMode('')
      setCollectReferenceNumber('')
      setCollectSplitPayments([])
      setRefundDialogOpen(false)
      setExistingPayments([])

      // Fetch payments for existing bill
      if (order.bill) {
        const supabase = createClient()
        supabase
          .from('payments')
          .select('*')
          .eq('bill_id', order.bill.id)
          .then(({ data }) => {
            if (data) setExistingPayments(data)
          })
      }
    }
  }, [order])

  if (!order) return null

  // Lookup waiter name from waiters prop
  const waiterName = waiters?.find(w => w.id === order.waiter_id)?.name || null
  const cashierName = userProfile?.name || null

  const activeItems = localItems.filter(i => !i.is_cancelled)
  const subtotal = activeItems.reduce((sum, item) => sum + item.total_price, 0)

  const serviceChargeOriginal = Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100
  const serviceCharge = serviceChargeRemoved ? 0 : serviceChargeOriginal

  let discountAmount = 0
  if (discountType === 'percent' && discountValue) {
    // Cap discount at 15%
    const cappedPercent = Math.min(parseFloat(discountValue) || 0, 15)
    discountAmount = Math.round(subtotal * cappedPercent / 100 * 100) / 100
  }
  discountAmount = Math.min(discountAmount, subtotal)

  // GST is on food value only (subtotal - discount), NOT including service charge
  const taxableAmount = Math.max(subtotal - discountAmount, 0)
  const gstAmount = Math.round(taxableAmount * GST_PERCENT / 100 * 100) / 100
  // Total = food value + service charge + GST
  const total = Math.max(Math.round((taxableAmount + serviceCharge + gstAmount) * 100) / 100, 0)

  const splitTotal = splitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const splitRemaining = Math.round((total - splitTotal) * 100) / 100

  const tableName = order.table
    ? getTableDisplayName(order.table)
    : 'Takeaway'

  // Discount is always password-protected
  const effectiveDiscountPercent = parseFloat(discountValue) || 0
  const needsDiscountAuth = discountType !== 'none'
    && effectiveDiscountPercent > 0
    && !discountPinVerified

  async function verifyPassword(password: string): Promise<boolean> {
    if (!password.trim()) return false
    const supabase = createClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'security_pin')
      .single()

    if (!data?.value) {
      toast.error('Security PIN not configured. Ask admin to set it in Settings.')
      return false
    }
    return data.value === password
  }

  async function verifyDiscountPin() {
    setDiscountPinVerifying(true)
    const valid = await verifyPassword(discountPin)
    if (!valid) {
      toast.error('Invalid PIN')
      setDiscountPinVerifying(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      action: 'discount_applied',
      order_id: order?.id || null,
      performed_by: user?.id || null,
      details: {
        discount_type: 'percent',
        discount_value: discountValue,
        discount_reason: discountReason,
        effective_percent: effectiveDiscountPercent.toFixed(1),
        subtotal,
        discount_amount: discountAmount,
      },
    })

    setDiscountPinVerified(true)
    setDiscountPinDialogOpen(false)
    setDiscountPinVerifying(false)
    setDiscountPin('')
    toast.success('Discount authorized')
  }

  async function printPreviewBill() {
    if (!order) return
    setPrinting(true)
    try {
      await printBill({
        billNumber: 'PREVIEW',
        orderNumber: order.order_number,
        tableName: order.table ? getTableDisplayName(order.table) : null,
        orderType: order.order_type as 'dine_in' | 'takeaway',
        items: activeItems.map(i => ({
          name: i.menu_item?.name || 'Unknown',
          quantity: i.quantity,
          unitPrice: i.unit_price,
        })),
        subtotal,
        gstPercent: GST_PERCENT,
        gstAmount,
        serviceCharge,
        serviceChargeRemoved,
        discountAmount,
        discountType,
        discountReason: discountReason || undefined,
        total,
        paymentMode: 'preview',
        cashierName,
        waiterName,
      })

      // Track print count for Hawkeye reprint flagging
      const supabase = createClient()
      const currentPrintCount = order.bill_print_count || 0
      const newPrintCount = currentPrintCount + 1
      await supabase.from('orders')
        .update({ bill_print_count: newPrintCount })
        .eq('id', order.id)

      // If this is a reprint (already printed before), flag in Hawkeye
      if (currentPrintCount >= 1) {
        const { data: { user } } = await supabase.auth.getUser()
        const tableName = order.table ? getTableDisplayName(order.table) : 'Unknown'
        await supabase.from('audit_logs').insert({
          action: 'bill_reprint',
          order_id: order.id,
          performed_by: user?.id || null,
          details: {
            order_number: order.order_number,
            table: tableName,
            total,
            print_count: newPrintCount,
            reason: 'Preview reprinted from billing dialog',
          },
        })
      }

      toast.success(currentPrintCount >= 1 ? 'Bill reprinted (flagged)' : 'Bill printed — show to customer')
    } catch {
      toast.error('Bill print failed — check printer')
    } finally {
      setPrinting(false)
    }
  }

  async function settleBill() {
    if (!order) return

    if (!paymentMode) {
      toast.error('Please select a payment mode')
      return
    }

    // Validate reference number
    if (requirePaymentRef && (paymentMode === 'upi' || paymentMode === 'card' || paymentMode === 'zomato') && !referenceNumber.trim()) {
      toast.error('Reference number is required for UPI/Card/Zomato payments')
      return
    }

    if (needsDiscountAuth) {
      setDiscountPinDialogOpen(true)
      return
    }

    if (paymentMode === 'split') {
      if (splitPayments.length < 2) {
        toast.error('Add at least 2 split payments')
        return
      }
      if (Math.abs(splitRemaining) > 0.5) {
        toast.error('Split payments must equal the total')
        return
      }
      // Validate reference numbers for split UPI/Card
      if (requirePaymentRef) {
        const missingRef = splitPayments.some(p =>
          (p.mode === 'upi' || p.mode === 'card' || p.mode === 'zomato') && !p.reference_number.trim()
        )
        if (missingRef) {
          toast.error('Reference number required for UPI/Card/Zomato split payments')
          return
        }
      }
    }

    setSettling(true)
    const supabase = createClient()

    try {
      const { data: billNum } = await supabase.rpc('generate_bill_number')

      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          order_id: order.id,
          subtotal,
          gst_percent: GST_PERCENT,
          gst_amount: gstAmount,
          service_charge: serviceChargeOriginal,
          service_charge_removed: serviceChargeRemoved,
          discount_amount: discountAmount,
          discount_type: discountType,
          discount_reason: discountReason || null,
          total,
          payment_mode: paymentMode as PaymentMode,
          payment_status: 'paid',
          bill_number: billNum || `BILL-${Date.now()}`,
        })
        .select()
        .single()

      if (billError || !bill) {
        toast.error('Failed to create bill: ' + (billError?.message || 'Unknown error'))
        return
      }

      // Create payment records
      if (paymentMode === 'split') {
        const paymentRecords = splitPayments.map(p => ({
          bill_id: bill.id,
          mode: p.mode,
          amount: parseFloat(p.amount) || 0,
          reference_number: (p.mode === 'upi' || p.mode === 'card' || p.mode === 'zomato') && p.reference_number.trim()
            ? p.reference_number.trim() : null,
        }))
        await supabase.from('payments').insert(paymentRecords)
      } else {
        await supabase.from('payments').insert({
          bill_id: bill.id,
          mode: paymentMode,
          amount: total,
          reference_number: (paymentMode === 'upi' || paymentMode === 'card' || paymentMode === 'zomato') && referenceNumber.trim()
            ? referenceNumber.trim() : null,
        })
      }

      // NC audit log
      if (paymentMode === 'nc') {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          action: 'nc_payment',
          order_id: order.id,
          performed_by: user?.id || null,
          details: {
            order_number: order.order_number,
            bill_number: bill.bill_number,
            total,
            reason: ncReason.trim(),
            table: order.table ? getTableDisplayName(order.table) : 'Takeaway',
          },
        })
      }

      await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', order.id)

      // Only free table if it still has this order (not if a new order has taken over)
      if (order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'available', current_order_id: null })
          .eq('id', order.table_id)
          .eq('current_order_id', order.id)
      }

      printBill({
        billNumber: bill.bill_number,
        orderNumber: order.order_number,
        tableName: order.table ? getTableDisplayName(order.table) : null,
        orderType: order.order_type as 'dine_in' | 'takeaway',
        items: activeItems.map(i => ({
          name: i.menu_item?.name || 'Unknown',
          quantity: i.quantity,
          unitPrice: i.unit_price,
        })),
        subtotal,
        gstPercent: GST_PERCENT,
        gstAmount,
        serviceCharge,
        serviceChargeRemoved,
        discountAmount,
        discountType,
        discountReason: discountReason || undefined,
        total,
        paymentMode,
        payments: paymentMode === 'split'
          ? splitPayments.map(p => ({ mode: p.mode, amount: parseFloat(p.amount) || 0 }))
          : undefined,
        cashierName,
        waiterName,
      }).catch(() => {
        toast.error('Bill print failed - check printer', { duration: 5000 })
      })

      const hasCashPayment = paymentMode === 'cash' ||
        (paymentMode === 'split' && splitPayments.some(p => p.mode === 'cash'))
      if (hasCashPayment) {
        openCashDrawer().catch(() => {
          toast.error('Cash drawer failed', { duration: 3000 })
        })
      }

      toast.success(`Bill ${bill.bill_number} settled - ₹${total.toFixed(2)}`)
      onBillSettled()
      onClose()
    } catch (err) {
      toast.error('Failed to settle bill')
    } finally {
      setSettling(false)
    }
  }

  // Collect balance split helpers
  function addCollectSplit() {
    setCollectSplitPayments([...collectSplitPayments, { mode: 'cash', amount: '', reference_number: '' }])
  }
  function removeCollectSplit(index: number) {
    setCollectSplitPayments(collectSplitPayments.filter((_, i) => i !== index))
  }
  function updateCollectSplit(index: number, field: 'mode' | 'amount' | 'reference_number', value: string) {
    const updated = [...collectSplitPayments]
    if (field === 'mode') { updated[index].mode = value as PaymentMode; updated[index].reference_number = '' }
    else if (field === 'amount') { updated[index].amount = value }
    else { updated[index].reference_number = value }
    setCollectSplitPayments(updated)
  }

  async function collectBalance() {
    if (!existingBill || !order) return
    if (!collectPaymentMode) {
      toast.error('Select a payment mode')
      return
    }

    const paidSoFar = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const outstanding = Number(existingBill.total) - paidSoFar

    if (outstanding <= 0) {
      toast.error('No balance to collect')
      return
    }

    // Split payment validation
    if (collectPaymentMode === 'split') {
      const splitTotal = collectSplitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      const diff = Math.abs(splitTotal - outstanding)
      if (diff > 0.5) {
        toast.error(`Split total (₹${splitTotal.toFixed(2)}) must equal outstanding (₹${outstanding.toFixed(2)})`)
        return
      }
      for (const sp of collectSplitPayments) {
        if (!sp.amount || parseFloat(sp.amount) <= 0) {
          toast.error('All split entries need an amount')
          return
        }
        if (requirePaymentRef && (sp.mode === 'upi' || sp.mode === 'card' || sp.mode === 'zomato') && !sp.reference_number.trim()) {
          toast.error(`Reference number required for ${sp.mode.toUpperCase()} payment`)
          return
        }
      }
    } else {
      if (requirePaymentRef && (collectPaymentMode === 'upi' || collectPaymentMode === 'card' || collectPaymentMode === 'zomato') && !collectReferenceNumber.trim()) {
        toast.error('Reference number is required')
        return
      }
    }

    setCollecting(true)
    const supabase = createClient()

    try {
      if (collectPaymentMode === 'split') {
        // Insert multiple payment records
        const paymentRows = collectSplitPayments.map(sp => ({
          bill_id: existingBill.id,
          mode: sp.mode,
          amount: parseFloat(sp.amount),
          reference_number: (sp.mode === 'upi' || sp.mode === 'card' || sp.mode === 'zomato') && sp.reference_number.trim()
            ? sp.reference_number.trim() : null,
        }))
        await supabase.from('payments').insert(paymentRows)
      } else {
        // Single payment for the balance
        await supabase.from('payments').insert({
          bill_id: existingBill.id,
          mode: collectPaymentMode,
          amount: outstanding,
          reference_number: (collectPaymentMode === 'upi' || collectPaymentMode === 'card' || collectPaymentMode === 'zomato') && collectReferenceNumber.trim()
            ? collectReferenceNumber.trim() : null,
        })
      }

      // Determine new payment_mode
      const allModes = new Set(existingPayments.map(p => p.mode))
      if (collectPaymentMode === 'split') {
        collectSplitPayments.forEach(sp => allModes.add(sp.mode))
      } else {
        allModes.add(collectPaymentMode as PaymentMode)
      }
      const newPaymentMode = allModes.size > 1 ? 'split' : (collectPaymentMode === 'split' ? 'split' : collectPaymentMode)

      // Update bill to paid
      await supabase
        .from('bills')
        .update({ payment_status: 'paid', payment_mode: newPaymentMode })
        .eq('id', existingBill.id)

      // Complete the order
      await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', order.id)

      // Free the table only if it still has this order (not if a new order has taken over)
      if (order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'available', current_order_id: null })
          .eq('id', order.table_id)
          .eq('current_order_id', order.id)
      }

      // Audit log
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        action: 'balance_collected',
        order_id: order.id,
        bill_id: existingBill.id,
        performed_by: user?.id || null,
        details: {
          bill_number: existingBill.bill_number,
          amount_collected: outstanding,
          payment_mode: collectPaymentMode === 'split' ? 'split' : collectPaymentMode,
          split_details: collectPaymentMode === 'split' ? collectSplitPayments.map(sp => ({ mode: sp.mode, amount: parseFloat(sp.amount) })) : undefined,
          total: existingBill.total,
        },
      })

      const hasCash = collectPaymentMode === 'cash' || (collectPaymentMode === 'split' && collectSplitPayments.some(sp => sp.mode === 'cash'))
      if (hasCash) {
        openCashDrawer().catch(() => {})
      }

      toast.success(`Balance ₹${outstanding.toFixed(2)} collected`)
      onBillSettled()
      onClose()
    } catch (err) {
      toast.error('Failed to collect balance')
    } finally {
      setCollecting(false)
    }
  }

  // Table transfer
  async function transferTable(newTable: TableType) {
    if (!order) return
    setTransferring(true)
    const supabase = createClient()

    await supabase.from('orders').update({ table_id: newTable.id }).eq('id', order.id)

    // Only free old table if it still has this order
    if (order.table_id) {
      await supabase.from('tables').update({ status: 'available', current_order_id: null }).eq('id', order.table_id).eq('current_order_id', order.id)
    }
    await supabase.from('tables').update({ status: 'occupied', current_order_id: order.id }).eq('id', newTable.id)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      action: 'table_transfer',
      order_id: order.id,
      performed_by: user?.id || null,
      details: {
        order_number: order.order_number,
        from_table: order.table ? getTableDisplayName(order.table) : 'Takeaway',
        to_table: getTableDisplayName(newTable),
        to_section: newTable.section,
      },
    })

    toast.success(`Transferred to ${getTableDisplayName(newTable)}`)
    setTransferring(false)
    setTransferDialogOpen(false)
    onBillSettled()
    onClose()
  }

  // Waiter reassignment
  async function reassignWaiter(newWaiter: Profile) {
    if (!order) return
    setReassigning(true)
    const supabase = createClient()

    await supabase.from('orders').update({ waiter_id: newWaiter.id }).eq('id', order.id)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      action: 'waiter_reassign',
      order_id: order.id,
      performed_by: user?.id || null,
      details: {
        order_number: order.order_number,
        new_waiter: newWaiter.name,
        new_waiter_id: newWaiter.id,
      },
    })

    toast.success(`Reassigned to ${newWaiter.name}`)
    setReassigning(false)
    setReassignDialogOpen(false)
    onBillSettled()
    onClose()
  }

  function addSplitPayment() {
    const currentTotal = splitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const remaining = Math.round(total) - currentTotal
    setSplitPayments([...splitPayments, { mode: 'cash', amount: remaining > 0 ? String(Math.round(remaining)) : '', reference_number: '' }])
  }

  function removeSplitPayment(index: number) {
    setSplitPayments(splitPayments.filter((_, i) => i !== index))
  }

  function updateSplitPayment(index: number, field: 'mode' | 'amount' | 'reference_number', value: string) {
    const updated = [...splitPayments]
    if (field === 'mode') {
      updated[index].mode = value as PaymentMode
      updated[index].reference_number = ''
    } else if (field === 'amount') {
      updated[index].amount = value
    } else {
      updated[index].reference_number = value
    }
    setSplitPayments(updated)
  }

  // Open cancel dialog
  function openCancelDialog(itemId: string, itemName: string) {
    setCancelItemId(itemId)
    setCancelItemName(itemName)
    setCancelReason('')
    setCancelPassword('')
    setCancelDialogOpen(true)
  }

  // Execute cancel with password verification
  async function confirmCancelItem() {
    if (!order) return
    if (!cancelReason.trim()) {
      toast.error('Please enter a reason for cancellation')
      return
    }

    setCancelling(true)
    const valid = await verifyPassword(cancelPassword)
    if (!valid) {
      toast.error('Invalid password')
      setCancelling(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('order_items')
      .update({ is_cancelled: true, cancel_reason: cancelReason.trim() })
      .eq('id', cancelItemId)

    if (error) {
      toast.error('Failed to cancel item')
      setCancelling(false)
      return
    }

    await supabase.from('audit_logs').insert({
      action: 'item_cancel',
      order_id: order.id,
      performed_by: user?.id || null,
      details: {
        item_name: cancelItemName,
        item_id: cancelItemId,
        reason: cancelReason.trim(),
        order_number: order.order_number,
        table: order.table ? getTableDisplayName(order.table) : 'Takeaway',
      },
    })

    setLocalItems(prev => prev.map(item =>
      item.id === cancelItemId
        ? { ...item, is_cancelled: true, cancel_reason: cancelReason.trim() }
        : item
    ))

    toast.success('Item cancelled')
    setCancelling(false)
    setCancelDialogOpen(false)
    onBillSettled()
  }

  async function confirmNcPayment() {
    if (!order) return
    if (!ncReason.trim()) {
      toast.error('Please enter a reason for NC')
      return
    }

    setNcVerifying(true)
    const valid = await verifyPassword(ncPin)
    if (!valid) {
      toast.error('Invalid PIN')
      setNcVerifying(false)
      return
    }

    // Mark NC as authorized — settle button will now work
    setNcAuthorized(true)
    setNcVerifying(false)
    toast.success('NC authorized — press Settle to complete')
  }

  function openReprintDialog() {
    setReprintPassword('')
    setReprintDialogOpen(true)
  }

  async function confirmReprint() {
    setReprinting(true)
    const valid = await verifyPassword(reprintPassword)
    if (!valid) {
      toast.error('Invalid password')
      setReprinting(false)
      return
    }

    if (!existingBill || !order) {
      setReprinting(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      action: 'bill_reprint',
      order_id: order.id,
      bill_id: existingBill.id,
      performed_by: user?.id || null,
      details: {
        bill_number: existingBill.bill_number,
        order_number: order.order_number,
        table: order.table ? getTableDisplayName(order.table) : 'Takeaway',
        total: existingBill.total,
      },
    })

    toast.promise(
      printBill({
        billNumber: existingBill.bill_number,
        orderNumber: order.order_number,
        tableName: order.table ? getTableDisplayName(order.table) : null,
        orderType: order.order_type as 'dine_in' | 'takeaway',
        items: activeItems.map(i => ({
          name: i.menu_item?.name || 'Unknown',
          quantity: i.quantity,
          unitPrice: i.unit_price,
        })),
        subtotal: Number(existingBill.subtotal),
        gstPercent: Number(existingBill.gst_percent),
        gstAmount: Number(existingBill.gst_amount),
        serviceCharge: Number(existingBill.service_charge),
        serviceChargeRemoved: existingBill.service_charge_removed,
        discountAmount: Number(existingBill.discount_amount),
        discountType: existingBill.discount_type || 'none',
        discountReason: existingBill.discount_reason || undefined,
        isReprint: true,
        total: Number(existingBill.total),
        paymentMode: existingBill.payment_mode,
        cashierName,
        waiterName,
      }),
      {
        loading: 'Sending to printer...',
        success: 'Bill sent to printer',
        error: 'Print failed - check printer connection',
      }
    )

    setReprinting(false)
    setReprintDialogOpen(false)
  }

  // Service charge removal with PIN
  async function handleScRemoveClick() {
    if (serviceChargeRemoved) {
      // Re-adding service charge → no PIN needed
      setServiceChargeRemoved(false)
      // Persist to orders table
      if (order?.id) {
        const supabase = createClient()
        await supabase.from('orders').update({ service_charge_removed: false }).eq('id', order.id)
      }
    } else {
      // Removing service charge → require PIN
      setScPin('')
      setScPinDialogOpen(true)
    }
  }

  async function confirmScRemoval() {
    setScPinVerifying(true)
    const valid = await verifyPassword(scPin)
    if (!valid) {
      toast.error('Invalid PIN')
      setScPinVerifying(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      action: 'sc_removal',
      order_id: order?.id || null,
      performed_by: user?.id || null,
      details: {
        order_number: order?.order_number,
        table: order?.table ? getTableDisplayName(order.table) : 'Takeaway',
        service_charge_amount: (Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100).toFixed(2),
      },
    })

    setServiceChargeRemoved(true)
    // Persist to orders table
    if (order?.id) {
      await supabase.from('orders').update({ service_charge_removed: true }).eq('id', order.id)
    }
    setScPinDialogOpen(false)
    setScPinVerifying(false)
    setScPin('')
    toast.success('Service charge removed')
  }

  // If bill already exists, show bill details
  if (existingBill) {
    const paidSoFar = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const outstanding = Number(existingBill.total) - paidSoFar
    const isPartial = existingBill.payment_status === 'partial'
    const hasRefund = Number(existingBill.total_refunded || 0) > 0

    return (
      <>
        <Dialog open={open} onOpenChange={(isOpen) => {
          // Prevent dismiss when reprint or refund dialog is open
          if (!isOpen && (reprintDialogOpen || refundDialogOpen)) return
          if (!isOpen) onClose()
        }}>
          <DialogContent className="max-w-lg max-h-[85vh] !grid-rows-[auto_1fr] overflow-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {existingBill.bill_number} — {tableName}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {isPartial ? (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      <Clock className="h-3 w-3 mr-1" />Outstanding: ₹{outstanding.toFixed(2)}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-600 text-xs">Paid - {existingBill.payment_mode?.toUpperCase()}</Badge>
                  )}
                  {hasRefund && (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      <RotateCcw className="h-3 w-3 mr-1" />Refunded: ₹{Number(existingBill.total_refunded).toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-2 overflow-y-auto -mx-4 px-4 pb-1">
              {/* Items */}
              <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                {activeItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.menu_item?.name}</span>
                    <span>₹{item.total_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Charges */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span><span>₹{Number(existingBill.subtotal).toFixed(2)}</span>
                </div>
                {Number(existingBill.service_charge) > 0 && !existingBill.service_charge_removed && (
                  <div className="flex justify-between">
                    <span>Service Charge</span><span>₹{Number(existingBill.service_charge).toFixed(2)}</span>
                  </div>
                )}
                {Number(existingBill.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span><span>-₹{Number(existingBill.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST ({existingBill.gst_percent}%)</span><span>₹{Number(existingBill.gst_amount).toFixed(2)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span><span>₹{Number(existingBill.total).toFixed(2)}</span>
              </div>

              {/* Payments */}
              {existingPayments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                  <p className="text-xs font-medium text-gray-500">Payments</p>
                  {existingPayments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{p.mode.toUpperCase()}</Badge>
                        {p.reference_number && <span className="text-xs text-gray-400">Ref: {p.reference_number}</span>}
                      </span>
                      <span>₹{Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {!isPartial && !hasRefund && Number(existingBill.total_refunded || 0) < Number(existingBill.total) && (
                  <Button variant="outline" size="sm" onClick={() => setRefundDialogOpen(true)}>
                    <RotateCcw className="h-4 w-4 mr-1" />Refund
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={openReprintDialog}>
                  <Printer className="h-4 w-4 mr-1" />Reprint
                </Button>
              </div>

              {/* Collect Balance */}
              {isPartial && (
                <div className="border rounded-lg p-3 space-y-2.5 bg-amber-50">
                  {!collectBalanceMode ? (
                    <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => setCollectBalanceMode(true)}>
                      Collect Balance — ₹{outstanding.toFixed(2)}
                    </Button>
                  ) : (
                    <>
                      <Label className="text-sm font-medium">Payment Mode</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[...PAYMENT_MODES.filter(pm => pm.value !== 'nc'), { value: 'split', label: 'Split' }].map(pm => (
                          <Button key={pm.value} variant={collectPaymentMode === pm.value ? 'default' : 'outline'}
                            size="sm" onClick={() => {
                              if (pm.value === 'split') {
                                setCollectPaymentMode('split')
                                setCollectReferenceNumber('')
                                if (collectSplitPayments.length === 0) setCollectSplitPayments([
                                  { mode: 'cash', amount: '', reference_number: '' },
                                  { mode: 'upi', amount: '', reference_number: '' },
                                ])
                              } else {
                                setCollectPaymentMode(pm.value as PaymentMode)
                                setCollectSplitPayments([])
                              }
                            }}>{pm.label}</Button>
                        ))}
                      </div>
                      {collectPaymentMode !== 'split' && (collectPaymentMode === 'upi' || collectPaymentMode === 'card' || collectPaymentMode === 'zomato') && (
                        <Input placeholder={`${collectPaymentMode === 'upi' ? 'UPI' : collectPaymentMode === 'zomato' ? 'Zomato order' : 'Card'} reference number`}
                          value={collectReferenceNumber} onChange={e => setCollectReferenceNumber(e.target.value)} />
                      )}
                      {/* Split payment details */}
                      {collectPaymentMode === 'split' && (
                        <div className="bg-white rounded-lg p-2.5 space-y-2 border">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">Split Payments</span>
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => {
                                const half = Math.round(outstanding / 2 * 100) / 100
                                const other = Math.round((outstanding - half) * 100) / 100
                                setCollectSplitPayments([
                                  { mode: 'cash', amount: String(half), reference_number: '' },
                                  { mode: 'upi', amount: String(other), reference_number: '' },
                                ])
                              }}>50/50</Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={addCollectSplit}>+ Add</Button>
                            </div>
                          </div>
                          {collectSplitPayments.map((sp, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <select value={sp.mode} onChange={e => updateCollectSplit(idx, 'mode', e.target.value)}
                                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white">
                                  <option value="cash">Cash</option><option value="upi">UPI</option>
                                  <option value="card">Card</option><option value="zomato">Zomato</option>
                                </select>
                                <Input type="number" placeholder="Amount" value={sp.amount}
                                  onChange={e => updateCollectSplit(idx, 'amount', e.target.value)} className="flex-1 h-8 text-xs" />
                                <button onClick={() => removeCollectSplit(idx)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-100 border border-red-200">
                                  <X className="h-3.5 w-3.5" /></button>
                              </div>
                              {(sp.mode === 'upi' || sp.mode === 'card' || sp.mode === 'zomato') && (
                                <Input placeholder={`Ref #${requirePaymentRef ? ' *' : ''}`} value={sp.reference_number}
                                  onChange={e => updateCollectSplit(idx, 'reference_number', e.target.value)} className="h-7 text-xs" />
                              )}
                            </div>
                          ))}
                          {(() => {
                            const splitTotal = collectSplitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
                            const remaining = Math.round((outstanding - splitTotal) * 100) / 100
                            return (
                              <div className="flex justify-between text-xs pt-2 border-t border-gray-200">
                                <span>Remaining</span>
                                <span className={`font-semibold ${remaining > 0.5 ? 'text-red-500' : 'text-green-500'}`}>
                                  ₹{remaining.toFixed(2)}
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { setCollectBalanceMode(false); setCollectSplitPayments([]) }}>Cancel</Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={collectBalance}
                          disabled={collecting || !collectPaymentMode}>
                          {collecting ? 'Collecting...' : `Pay ₹${outstanding.toFixed(2)}`}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reprint Password Dialog */}
        <Dialog open={reprintDialogOpen} onOpenChange={setReprintDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                Authorization Required
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter security PIN to reprint bill <strong>{existingBill.bill_number}</strong>
              </p>
              <div className="space-y-2">
                <Label>Security PIN</Label>
                <Input
                  type="password"
                  placeholder="Enter PIN"
                  value={reprintPassword}
                  onChange={(e) => setReprintPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmReprint()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setReprintDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={confirmReprint} disabled={reprinting}>
                  {reprinting ? 'Verifying...' : 'Reprint Bill'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <RefundDialog
          bill={existingBill}
          order={order}
          open={refundDialogOpen}
          onClose={() => setRefundDialogOpen(false)}
          onRefunded={() => {
            onBillSettled()
            onClose()
          }}
          verifyPassword={verifyPassword}
        />
      </>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        // Prevent main dialog from closing when a sub-dialog is open
        // (base-ui treats portaled sub-dialog clicks as "outside" the main dialog)
        if (!isOpen && (cancelDialogOpen || discountPinDialogOpen || scPinDialogOpen || transferDialogOpen || reassignDialogOpen)) return
        if (!isOpen) onClose()
      }}>
        <DialogContent className="!w-[92vw] !max-w-[1400px] !h-[56vw] !max-h-[85vh] !grid-rows-none !flex !flex-col !gap-0 !p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* ── HEADER ── */}
          <div className="px-8 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-amber-600 text-white flex items-center justify-center text-base font-bold shadow-md shadow-amber-200">
                  {tableName.replace(/[^A-Z0-9]/gi, '').slice(0, 3)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">{tableName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 font-mono">{order.order_number}</span>
                    <span className="text-gray-300">·</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${order.order_type === 'dine_in' ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-orange-200 text-orange-600 bg-orange-50'}`}>
                      {order.order_type === 'takeaway' ? 'Takeaway' : 'Dine In'}
                    </Badge>
                    {waiterName && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-amber-700 font-medium">Cpt: {waiterName}</span>
                      </>
                    )}
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">
                      {(() => {
                        const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                        return mins < 1 ? '<1m' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              {/* Quick actions */}
              {order.status !== 'completed' && (
                <div className="flex gap-1.5">
                  {onAddItems && (
                    <button onClick={() => { onClose(); onAddItems(order) }}
                      className="h-9 w-9 rounded-xl border border-amber-200 bg-white flex items-center justify-center text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm"
                      title="Add Items"><Plus className="h-4 w-4" /></button>
                  )}
                  {tables && tables.length > 0 && order.order_type === 'dine_in' && (
                    <button onClick={() => setTransferDialogOpen(true)}
                      className="h-9 w-9 rounded-xl border border-amber-200 bg-white flex items-center justify-center text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm"
                      title="Transfer Table"><ArrowRightLeft className="h-4 w-4" /></button>
                  )}
                  {waiters && waiters.length > 0 && (
                    <button onClick={() => setReassignDialogOpen(true)}
                      className="h-9 w-9 rounded-xl border border-amber-200 bg-white flex items-center justify-center text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm"
                      title="Reassign Captain"><UserRound className="h-4 w-4" /></button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── SIDE-BY-SIDE BODY ── */}
          <div className="flex-1 flex min-h-0 overflow-hidden bg-gray-50/30">
            {/* LEFT PANEL — Bill Items & Charges */}
            <div className="w-[40%] border-r border-gray-200 overflow-y-auto bg-white">
              <div className="px-6 py-4 space-y-3">
                {/* Items section header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Order Items</p>
                  <span className="text-xs text-gray-400 font-medium">{activeItems.length} items</span>
                </div>
                {order.bill_print_count && order.bill_print_count > 0 && order.status !== 'completed' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>Items locked — bill already printed</span>
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-0.5">
                  {activeItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-4.5 w-4.5 rounded border-2 flex items-center justify-center shrink-0 ${item.menu_item?.is_veg ? 'border-green-500' : 'border-red-500'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.menu_item?.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{item.menu_item?.name}</p>
                          <p className="text-[11px] text-gray-400">{item.quantity} × ₹{item.unit_price.toFixed(0)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">₹{item.total_price.toFixed(0)}</span>
                        {order.status !== 'completed' && !(order.bill_print_count && order.bill_print_count > 0) && (
                          <button onClick={() => openCancelDialog(item.id, item.menu_item?.name || 'Item')}
                            className="h-6 w-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {localItems.filter(i => i.is_cancelled).map(item => (
                    <div key={item.id} className="flex justify-between py-1 px-3 text-xs text-gray-400 line-through">
                      <span>{item.quantity}× {item.menu_item?.name}</span>
                      <span>₹{item.total_price.toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-gray-200" />

                {/* Charges breakdown */}
                <div className="space-y-2 px-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-700 tabular-nums">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="flex items-center gap-2 text-gray-500">
                      SC ({SERVICE_CHARGE_PERCENT}%)
                      <button
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                          serviceChargeRemoved
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'
                        }`}
                        onClick={handleScRemoveClick}
                      >
                        {serviceChargeRemoved ? '+ ADD' : '− REMOVE'}
                      </button>
                    </span>
                    <span className={`tabular-nums font-medium ${serviceChargeRemoved ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                      ₹{(Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100).toFixed(2)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600 font-medium">Discount</span>
                      <span className="tabular-nums font-medium text-emerald-600">−₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GST ({GST_PERCENT}%)</span>
                    <span className="font-medium text-gray-700 tabular-nums">₹{gstAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl px-4 py-2.5 border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">Grand Total</span>
                    <span className="font-black text-2xl text-amber-700 tabular-nums">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Discount Toggle */}
                <details className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors select-none">
                    <span className="flex items-center gap-2 font-medium"><Percent className="h-3.5 w-3.5 text-gray-400" /> Discount</span>
                    <span className="text-xs text-gray-400 group-open:rotate-90 transition-transform">▸</span>
                  </summary>
                  <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-2.5">
                    <div className="flex gap-2">
                      <Button variant={discountType === 'none' ? 'default' : 'outline'} size="sm" className="h-8 text-xs flex-1 rounded-lg"
                        onClick={() => { setDiscountType('none'); setDiscountValue(''); setDiscountPinVerified(false) }}>None</Button>
                      <Button variant={discountType === 'percent' ? 'default' : 'outline'} size="sm" className="h-8 text-xs flex-1 rounded-lg"
                        onClick={() => setDiscountType('percent')}>% Percent</Button>
                    </div>
                    {discountType === 'percent' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input type="number" placeholder="Enter % (max 15)" min="0" max="15" step="1"
                            value={discountValue} onChange={e => {
                              const v = parseFloat(e.target.value)
                              if (v > 15) { setDiscountValue('15'); } else { setDiscountValue(e.target.value); }
                              setDiscountPinVerified(false)
                            }}
                            className="h-8 text-sm flex-1 rounded-lg" />
                          <Input placeholder="Reason" value={discountReason}
                            onChange={e => setDiscountReason(e.target.value)} className="h-8 text-sm flex-1 rounded-lg" />
                        </div>
                        {/* Quick percent buttons */}
                        <div className="flex gap-1.5">
                          {[5, 10, 15].map(p => (
                            <button key={p} onClick={() => { setDiscountValue(String(p)); setDiscountPinVerified(false) }}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                discountValue === String(p) ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
                              }`}>{p}%</button>
                          ))}
                        </div>
                        {needsDiscountAuth && (
                          <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg">
                            <Lock className="h-3.5 w-3.5 shrink-0" />PIN required to apply discount
                          </p>
                        )}
                        {discountPinVerified && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
                            <Check className="h-3.5 w-3.5 shrink-0" />Discount authorized
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </details>

                {/* Print Preview */}
                <button onClick={printPreviewBill} disabled={printing}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-medium text-sm hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50/50 transition-all disabled:opacity-50">
                  <Printer className="h-4 w-4" />
                  {printing ? 'Printing...' : 'Print Preview'}
                </button>
              </div>
            </div>

            {/* RIGHT PANEL — Payment & Settlement */}
            <div className="w-[60%] flex flex-col min-h-0 bg-white">
              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Payment</p>

                {/* Payment method grid — 6 across on wide dialog */}
                <div className="grid grid-cols-6 gap-2.5">
                  {[
                    { mode: 'cash' as const, icon: Banknote, label: 'Cash' },
                    { mode: 'upi' as const, icon: Smartphone, label: 'UPI' },
                    { mode: 'card' as const, icon: CreditCard, label: 'Card' },
                    { mode: 'zomato' as const, icon: Store, label: 'Zomato' },
                    { mode: 'split' as const, icon: Split, label: 'Split' },
                    { mode: 'nc' as const, icon: Gift, label: 'NC' },
                  ].map(pm => (
                    <button key={pm.mode}
                      onClick={() => {
                        if (pm.mode === 'nc') {
                          setPaymentMode('nc'); setSplitPayments([]); setReferenceNumber(''); setCashReceived('')
                          setNcReason(''); setNcPin(''); setNcAuthorized(false)
                          return
                        }
                        if (pm.mode === 'split') {
                          setPaymentMode('split'); setReferenceNumber(''); setCashReceived('')
                          if (splitPayments.length === 0) setSplitPayments([
                            { mode: 'cash', amount: '', reference_number: '' },
                            { mode: 'upi', amount: '', reference_number: '' },
                          ])
                          return
                        }
                        setPaymentMode(pm.mode); setSplitPayments([]); setReferenceNumber(''); setCashReceived('')
                        setNcAuthorized(false)
                      }}
                      className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all text-sm font-semibold ${
                        paymentMode === pm.mode
                          ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md shadow-amber-100 scale-[1.03]'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                      }`}
                    >
                      <pm.icon className={`h-6 w-6 ${paymentMode === pm.mode ? 'text-amber-600' : 'text-gray-400'}`} />
                      {pm.label}
                    </button>
                  ))}
                </div>

                {/* Cash received + change calculation */}
                {paymentMode === 'cash' && (() => {
                  const roundedTotal = Math.round(total)
                  const received = parseFloat(cashReceived) || 0
                  const change = received - roundedTotal
                  return (
                    <div className="bg-emerald-50 rounded-xl p-4 space-y-3 border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-emerald-800">Bill Amount (Rounded)</span>
                        <span className="text-xl font-bold text-emerald-800">₹{roundedTotal}</span>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-emerald-700 mb-1.5 block uppercase tracking-wider">Cash Received</label>
                        <Input type="number" placeholder="Enter amount" autoFocus
                          value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                          className="h-12 text-xl font-bold bg-white border-emerald-300 focus-visible:ring-emerald-400 rounded-lg" />
                      </div>
                      {received > 0 && (
                        <div className={`flex items-center justify-between py-3 px-4 rounded-xl ${change >= 0 ? 'bg-emerald-100 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                          <span className={`text-sm font-bold ${change >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {change >= 0 ? 'Return Change' : 'Amount Short'}
                          </span>
                          <span className={`text-2xl font-black ${change >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            ₹{Math.abs(change)}
                          </span>
                        </div>
                      )}
                      {/* Quick amount buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {[roundedTotal, ...([50, 100, 200, 500, 1000, 2000].filter(v => v > roundedTotal).slice(0, 4))].map(amt => (
                          <button key={amt} onClick={() => setCashReceived(String(amt))}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                              cashReceived === String(amt)
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                            }`}>
                            {amt === roundedTotal ? 'Exact' : `₹${amt}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* UPI/Card/Zomato ref */}
                {(paymentMode === 'upi' || paymentMode === 'card' || paymentMode === 'zomato') && (
                  <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-800">
                        {paymentMode === 'upi' ? 'UPI' : paymentMode === 'zomato' ? 'Zomato' : 'Card'} Payment
                      </span>
                      <span className="text-xl font-bold text-blue-800">₹{Math.round(total)}</span>
                    </div>
                    <Input placeholder={`Enter ${paymentMode === 'upi' ? 'UPI transaction' : paymentMode === 'zomato' ? 'Zomato order' : 'Card transaction'} reference${requirePaymentRef ? ' (required)' : ''}`}
                      value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)}
                      className="h-11 bg-white border-blue-300 rounded-lg text-sm" />
                  </div>
                )}

                {/* Split Payment */}
                {paymentMode === 'split' && (() => {
                  const roundedTotal = Math.round(total)
                  return (
                    <div className="bg-violet-50 rounded-xl p-4 space-y-3 border border-violet-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-violet-800">Split Payment</span>
                        <span className="text-xl font-bold text-violet-800">₹{roundedTotal}</span>
                      </div>

                      {splitPayments.map((payment, index) => {
                        const prevTotal = splitPayments.slice(0, index).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                        const remaining = Math.round(roundedTotal - prevTotal)
                        return (
                          <div key={index} className="bg-white rounded-xl p-3 border border-violet-100 space-y-2.5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white bg-violet-500 rounded-full w-5 h-5 flex items-center justify-center">{index + 1}</span>
                                <span className="text-sm font-medium text-gray-700">Payment {index + 1}</span>
                              </div>
                              {splitPayments.length > 2 && (
                                <button onClick={() => removeSplitPayment(index)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                  <X className="h-4 w-4" /></button>
                              )}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { m: 'cash' as const, label: 'Cash', icon: Banknote },
                                { m: 'upi' as const, label: 'UPI', icon: Smartphone },
                                { m: 'card' as const, label: 'Card', icon: CreditCard },
                                { m: 'zomato' as const, label: 'Zomato', icon: Store },
                              ].map(opt => (
                                <button key={opt.m} onClick={() => updateSplitPayment(index, 'mode', opt.m)}
                                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border-2 text-[11px] font-semibold transition-all ${
                                    payment.mode === opt.m
                                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                  }`}>
                                  <opt.icon className="h-4 w-4" />
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input type="number" placeholder={remaining > 0 ? `Max ₹${remaining}` : 'Amount'}
                                value={payment.amount}
                                onChange={e => updateSplitPayment(index, 'amount', e.target.value)}
                                className="flex-1 h-10 text-sm font-bold rounded-lg" />
                              {remaining > 0 && !payment.amount && (
                                <button onClick={() => updateSplitPayment(index, 'amount', String(remaining))}
                                  className="px-3 py-2 rounded-lg text-xs font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 whitespace-nowrap transition-colors">
                                  ₹{remaining}
                                </button>
                              )}
                            </div>
                            {(payment.mode === 'upi' || payment.mode === 'card' || payment.mode === 'zomato') && (
                              <Input placeholder={`${payment.mode === 'upi' ? 'UPI' : payment.mode === 'zomato' ? 'Zomato' : 'Card'} ref${requirePaymentRef ? ' *' : ''}`}
                                value={payment.reference_number}
                                onChange={e => updateSplitPayment(index, 'reference_number', e.target.value)}
                                className="h-9 text-xs rounded-lg" />
                            )}
                          </div>
                        )
                      })}

                      <div className="flex items-center justify-between pt-1">
                        <Button variant="outline" size="sm" className="h-8 text-xs px-3 border-violet-300 text-violet-600 hover:bg-violet-50 rounded-lg" onClick={addSplitPayment}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Payment
                        </Button>
                        <div className={`text-sm font-bold px-4 py-1.5 rounded-lg ${
                          splitRemaining > 0.5 ? 'bg-red-100 text-red-600' : splitRemaining < -0.5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {Math.abs(splitRemaining) <= 0.5 ? '✓ Balanced' : splitRemaining > 0 ? `₹${splitRemaining.toFixed(0)} remaining` : `₹${Math.abs(splitRemaining).toFixed(0)} over`}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* NC (No Charge) inline authorization */}
                {paymentMode === 'nc' && (
                  <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-amber-800">No Charge (NC)</span>
                      <span className="text-xl font-bold text-amber-800">₹{total.toFixed(2)}</span>
                    </div>
                    {ncAuthorized ? (
                      <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-100 border border-emerald-200">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">NC Authorized</span>
                        <span className="text-xs text-emerald-600 ml-auto">Reason: {ncReason}</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-amber-700 mb-1.5 block uppercase tracking-wider">Reason for NC *</label>
                          <Textarea
                            placeholder="e.g., Owner's guest, Staff meal, Customer complaint..."
                            value={ncReason}
                            onChange={(e) => setNcReason(e.target.value)}
                            rows={2}
                            className="bg-white border-amber-300 focus-visible:ring-amber-400 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-amber-700 mb-1.5 block uppercase tracking-wider">Security PIN</label>
                          <Input
                            type="password"
                            placeholder="Enter PIN"
                            value={ncPin}
                            onChange={(e) => setNcPin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmNcPayment()}
                            className="h-11 bg-white border-amber-300 focus-visible:ring-amber-400 rounded-lg"
                          />
                        </div>
                        <button
                          onClick={confirmNcPayment}
                          disabled={ncVerifying || !ncReason.trim()}
                          className="w-full h-10 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {ncVerifying ? 'Verifying...' : 'Authorize NC'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Settle button pinned at bottom */}
              <div className="px-8 py-3 border-t border-gray-100 bg-white shrink-0">
                <button
                  onClick={settleBill}
                  disabled={settling || !paymentMode || (paymentMode === 'nc' && !ncAuthorized)}
                  className="w-full h-13 rounded-xl text-lg font-bold tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-green-600/30 active:scale-[0.98]"
                >
                  {settling ? 'Settling...' : `Settle — ₹${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Item Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cancelling <strong>{cancelItemName}</strong> from {order.order_number}
            </p>
            <div className="space-y-2">
              <Label>Reason for cancellation *</Label>
              <Textarea
                placeholder="e.g., Customer changed mind, Wrong item ordered..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Security PIN</Label>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmCancelItem()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelDialogOpen(false)}>
                Back
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={confirmCancelItem}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transfer Table
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-gray-500">
              Moving {order.order_number} from {tableName} to:
            </p>
            {groupTablesByDisplayGroup((tables || []).filter(t => t.status === 'available')).map(group => (
              <div key={group.group}>
                <p className="text-sm font-medium text-gray-500 mb-2">{group.label}</p>
                <div className="grid grid-cols-5 gap-2">
                  {group.tables.map(table => (
                    <button
                      key={table.id}
                      onClick={() => transferTable(table)}
                      disabled={transferring}
                      className="p-2 rounded-lg text-center border-2 border-green-300 bg-green-50 hover:border-amber-400 hover:bg-amber-50 transition-all"
                    >
                      <p className="text-sm font-bold">{getTableDisplayName(table)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {(tables || []).filter(t => t.status === 'available').length === 0 && (
              <p className="text-center text-gray-400 py-4">No available tables</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Waiter Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Reassign Captain
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-gray-500 mb-3">
              Reassign {order.order_number} to:
            </p>
            {(waiters || []).filter(w => w.id !== order.waiter_id).map(waiter => (
              <button
                key={waiter.id}
                onClick={() => reassignWaiter(waiter)}
                disabled={reassigning}
                className="w-full p-3 rounded-lg text-left border hover:border-amber-300 hover:bg-amber-50 transition-all flex items-center gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
                  {waiter.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm">{waiter.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{waiter.role}</p>
                </div>
              </button>
            ))}
            {(waiters || []).filter(w => w.id !== order.waiter_id).length === 0 && (
              <p className="text-center text-gray-400 py-4">No other staff available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount PIN Authorization Dialog */}
      <Dialog open={discountPinDialogOpen} onOpenChange={setDiscountPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Discount Authorization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Discount of <strong>{effectiveDiscountPercent.toFixed(0)}%</strong> exceeds the {discountMaxPercent}% cashier limit.
              Enter security PIN to authorize.
            </p>
            <div className="space-y-2">
              <Label>Security PIN</Label>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={discountPin}
                onChange={(e) => setDiscountPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyDiscountPin()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDiscountPinDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={verifyDiscountPin} disabled={discountPinVerifying}>
                {discountPinVerifying ? 'Verifying...' : 'Authorize'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Service Charge Removal PIN Dialog */}
      <Dialog open={scPinDialogOpen} onOpenChange={setScPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Remove Service Charge
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter security PIN to remove service charge of <strong>₹{(Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100).toFixed(2)}</strong>
            </p>
            <div className="space-y-2">
              <Label>Security PIN</Label>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={scPin}
                onChange={(e) => setScPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmScRemoval()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScPinDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmScRemoval} disabled={scPinVerifying}>
                {scPinVerifying ? 'Verifying...' : 'Remove SC'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
