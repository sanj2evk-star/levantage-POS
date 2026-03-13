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

  const [serviceChargeRemoved, setServiceChargeRemoved] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([])
  const [settling, setSettling] = useState(false)
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

  // NC (No Charge) state
  const [ncDialogOpen, setNcDialogOpen] = useState(false)
  const [ncReason, setNcReason] = useState('')
  const [ncPin, setNcPin] = useState('')
  const [ncVerifying, setNcVerifying] = useState(false)

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

  // Table transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  // Waiter reassignment state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  // Local items state to handle cancellation updates without stale data
  const [localItems, setLocalItems] = useState(order?.items || [])

  // Partial payment state
  const [payLaterMode, setPayLaterMode] = useState(false)
  const [partialAmount, setPartialAmount] = useState('')

  // Collect balance state (for partial bills)
  const [collectBalanceMode, setCollectBalanceMode] = useState(false)
  const [collectPaymentMode, setCollectPaymentMode] = useState<PaymentMode | ''>('')
  const [collectReferenceNumber, setCollectReferenceNumber] = useState('')
  const [collecting, setCollecting] = useState(false)

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
      setServiceChargeRemoved(false)
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
      setNcReason('')
      setNcPin('')
      setPayLaterMode(false)
      setPartialAmount('')
      setCollectBalanceMode(false)
      setCollectPaymentMode('')
      setCollectReferenceNumber('')
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

  const serviceCharge = serviceChargeRemoved ? 0 : Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100

  let discountAmount = 0
  if (discountType === 'percent' && discountValue) {
    discountAmount = Math.round(subtotal * parseFloat(discountValue) / 100 * 100) / 100
  } else if (discountType === 'flat' && discountValue) {
    discountAmount = parseFloat(discountValue) || 0
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

  // Check if discount exceeds cashier threshold
  const effectiveDiscountPercent = discountType === 'percent'
    ? (parseFloat(discountValue) || 0)
    : subtotal > 0 ? (discountAmount / subtotal) * 100 : 0
  const needsDiscountAuth = userProfile?.role === 'cashier'
    && discountType !== 'none'
    && effectiveDiscountPercent > discountMaxPercent
    && !discountPinVerified

  async function verifyPassword(password: string): Promise<boolean> {
    const supabase = createClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'security_pin')
      .single()

    if (!data?.value) return true
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
      action: 'discount_override',
      order_id: order?.id || null,
      performed_by: user?.id || null,
      details: {
        discount_type: discountType,
        discount_value: discountValue,
        discount_reason: discountReason,
        effective_percent: effectiveDiscountPercent.toFixed(1),
        threshold: discountMaxPercent,
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
      toast.success('Bill printed — show to customer')
    } catch {
      toast.error('Bill print failed — check printer')
    } finally {
      setPrinting(false)
    }
  }

  async function settleBill() {
    if (!order) return

    // Pay Later mode
    if (payLaterMode) {
      return settlePartialBill()
    }

    if (!paymentMode) {
      toast.error('Please select a payment mode')
      return
    }

    // Validate reference number
    if (requirePaymentRef && (paymentMode === 'upi' || paymentMode === 'card') && !referenceNumber.trim()) {
      toast.error('Reference number is required for UPI/Card payments')
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
          (p.mode === 'upi' || p.mode === 'card') && !p.reference_number.trim()
        )
        if (missingRef) {
          toast.error('Reference number required for UPI/Card split payments')
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
          service_charge: serviceCharge,
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
          reference_number: (p.mode === 'upi' || p.mode === 'card') && p.reference_number.trim()
            ? p.reference_number.trim() : null,
        }))
        await supabase.from('payments').insert(paymentRecords)
      } else {
        await supabase.from('payments').insert({
          bill_id: bill.id,
          mode: paymentMode,
          amount: total,
          reference_number: (paymentMode === 'upi' || paymentMode === 'card') && referenceNumber.trim()
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

      if (order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'available', current_order_id: null })
          .eq('id', order.table_id)
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

  async function settlePartialBill() {
    if (!order) return
    const partialAmt = parseFloat(partialAmount) || 0
    const selectedMode = paymentMode || 'cash'

    if (partialAmt > total) {
      toast.error('Partial amount cannot exceed total')
      return
    }

    if (partialAmt > 0 && requirePaymentRef && (selectedMode === 'upi' || selectedMode === 'card') && !referenceNumber.trim()) {
      toast.error('Reference number is required for UPI/Card payments')
      return
    }

    if (needsDiscountAuth) {
      setDiscountPinDialogOpen(true)
      return
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
          service_charge: serviceCharge,
          service_charge_removed: serviceChargeRemoved,
          discount_amount: discountAmount,
          discount_type: discountType,
          discount_reason: discountReason || null,
          total,
          payment_mode: partialAmt > 0 ? selectedMode as PaymentMode : null,
          payment_status: 'partial',
          bill_number: billNum || `BILL-${Date.now()}`,
        })
        .select()
        .single()

      if (billError || !bill) {
        toast.error('Failed to create bill: ' + (billError?.message || 'Unknown error'))
        return
      }

      // Create payment record only if partial amount > 0
      if (partialAmt > 0) {
        await supabase.from('payments').insert({
          bill_id: bill.id,
          mode: selectedMode,
          amount: partialAmt,
          reference_number: (selectedMode === 'upi' || selectedMode === 'card') && referenceNumber.trim()
            ? referenceNumber.trim() : null,
        })
      }

      // Log partial payment
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        action: 'partial_payment',
        order_id: order.id,
        bill_id: bill.id,
        performed_by: user?.id || null,
        details: {
          bill_number: bill.bill_number,
          total,
          paid: partialAmt,
          outstanding: total - partialAmt,
          payment_mode: partialAmt > 0 ? selectedMode : 'none',
        },
      })

      // For takeaway, complete the order but keep bill as partial
      if (order.order_type === 'takeaway') {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id)
      }
      // For dine-in, don't complete order or free table

      // Print bill
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
        paymentMode: partialAmt > 0 ? selectedMode : null,
        cashierName,
        waiterName,
      }).catch(() => {
        toast.error('Bill print failed - check printer', { duration: 5000 })
      })

      if (partialAmt > 0 && selectedMode === 'cash') {
        openCashDrawer().catch(() => {})
      }

      const outstanding = total - partialAmt
      toast.success(`Bill created - Outstanding: ₹${outstanding.toFixed(2)}`)
      onBillSettled()
      onClose()
    } catch (err) {
      toast.error('Failed to create partial bill')
    } finally {
      setSettling(false)
    }
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

    if (requirePaymentRef && (collectPaymentMode === 'upi' || collectPaymentMode === 'card') && !collectReferenceNumber.trim()) {
      toast.error('Reference number is required')
      return
    }

    setCollecting(true)
    const supabase = createClient()

    try {
      // Create payment for the balance
      await supabase.from('payments').insert({
        bill_id: existingBill.id,
        mode: collectPaymentMode,
        amount: outstanding,
        reference_number: (collectPaymentMode === 'upi' || collectPaymentMode === 'card') && collectReferenceNumber.trim()
          ? collectReferenceNumber.trim() : null,
      })

      // Determine new payment_mode
      const allModes = new Set(existingPayments.map(p => p.mode))
      allModes.add(collectPaymentMode as PaymentMode)
      const newPaymentMode = allModes.size > 1 ? 'split' : collectPaymentMode

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

      // Free the table
      if (order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'available', current_order_id: null })
          .eq('id', order.table_id)
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
          payment_mode: collectPaymentMode,
          total: existingBill.total,
        },
      })

      if (collectPaymentMode === 'cash') {
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

    if (order.table_id) {
      await supabase.from('tables').update({ status: 'available', current_order_id: null }).eq('id', order.table_id)
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
    setSplitPayments([...splitPayments, { mode: 'cash', amount: '', reference_number: '' }])
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

    // Set NC as payment mode and close dialog
    setPaymentMode('nc')
    setSplitPayments([])
    setReferenceNumber('')
    setNcDialogOpen(false)
    setNcVerifying(false)
    toast.success('NC authorized')
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

  // If bill already exists, show bill details
  if (existingBill) {
    const paidSoFar = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const outstanding = Number(existingBill.total) - paidSoFar
    const isPartial = existingBill.payment_status === 'partial'
    const hasRefund = Number(existingBill.total_refunded || 0) > 0

    return (
      <>
        <Dialog open={open} onOpenChange={onClose}>
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
                        {PAYMENT_MODES.map(pm => (
                          <Button key={pm.value} variant={collectPaymentMode === pm.value ? 'default' : 'outline'}
                            size="sm" onClick={() => setCollectPaymentMode(pm.value as PaymentMode)}>{pm.label}</Button>
                        ))}
                      </div>
                      {(collectPaymentMode === 'upi' || collectPaymentMode === 'card') && (
                        <Input placeholder={`${collectPaymentMode === 'upi' ? 'UPI' : 'Card'} reference number`}
                          value={collectReferenceNumber} onChange={e => setCollectReferenceNumber(e.target.value)} />
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setCollectBalanceMode(false)}>Cancel</Button>
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
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-[95vw] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* ── HEADER ── */}
          <div className="px-4 pt-4 pb-3 border-b bg-white shrink-0">
            <div className="flex items-center justify-between mb-2 pr-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{tableName}</h2>
                <p className="text-xs text-gray-500 font-medium">
                  {order.order_number} · {order.order_type === 'takeaway' ? 'Takeaway' : 'Dine In'}
                  {waiterName && <span className="text-amber-700"> · Cpt: {waiterName}</span>}
                  {(() => {
                    const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                    return <span className="text-gray-400"> · {mins < 1 ? '<1m' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}</span>
                  })()}
                </p>
              </div>
              {/* Quick actions */}
              {order.status !== 'completed' && (
                <div className="flex gap-1">
                  {onAddItems && (
                    <button onClick={() => { onClose(); onAddItems(order) }}
                      className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                      title="Add Items"><Plus className="h-4 w-4" /></button>
                  )}
                  {tables && tables.length > 0 && order.order_type === 'dine_in' && (
                    <button onClick={() => setTransferDialogOpen(true)}
                      className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                      title="Transfer Table"><ArrowRightLeft className="h-4 w-4" /></button>
                  )}
                  {waiters && waiters.length > 0 && (
                    <button onClick={() => setReassignDialogOpen(true)}
                      className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                      title="Reassign Captain"><UserRound className="h-4 w-4" /></button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Items */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
              {activeItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${item.menu_item?.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm truncate">{item.quantity}× {item.menu_item?.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-sm font-medium tabular-nums">₹{item.total_price.toFixed(0)}</span>
                    {order.status !== 'completed' && (
                      <button onClick={() => openCancelDialog(item.id, item.menu_item?.name || 'Item')}
                        className="h-5 w-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {localItems.filter(i => i.is_cancelled).map(item => (
                <div key={item.id} className="flex justify-between px-3 py-1.5 text-xs text-gray-400 line-through">
                  <span>{item.quantity}× {item.menu_item?.name}</span>
                  <span>₹{item.total_price.toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Charges */}
            <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span className="font-medium">Subtotal</span>
                <span className="tabular-nums font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 items-center">
                <span className="flex items-center gap-2">
                  Service Charge ({SERVICE_CHARGE_PERCENT}%)
                  <button
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                      serviceChargeRemoved
                        ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                        : 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
                    }`}
                    onClick={() => setServiceChargeRemoved(!serviceChargeRemoved)}
                  >
                    {serviceChargeRemoved ? '+ Add' : '✕ Remove'}
                  </button>
                </span>
                <span className={`tabular-nums ${serviceChargeRemoved ? 'line-through text-gray-300' : ''}`}>
                  ₹{(Math.round(subtotal * SERVICE_CHARGE_PERCENT / 100 * 100) / 100).toFixed(2)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Discount</span>
                  <span className="tabular-nums">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>GST ({GST_PERCENT}%)</span>
                <span className="tabular-nums">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between items-center">
                <span className="font-bold text-base text-gray-900">Total</span>
                <span className="font-bold text-xl text-amber-700 tabular-nums">₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Discount Toggle */}
            <details className="group rounded-xl border border-gray-100 bg-white overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-3.5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                <span className="flex items-center gap-1.5 font-medium"><Percent className="h-3.5 w-3.5" /> Discount</span>
                <span className="text-xs text-gray-400 group-open:hidden">tap to expand ›</span>
              </summary>
              <div className="px-3.5 pb-3 space-y-2 border-t border-gray-100 pt-2.5">
                <div className="flex gap-1.5">
                  <Button variant={discountType === 'none' ? 'default' : 'outline'} size="sm" className="h-8 text-xs flex-1"
                    onClick={() => { setDiscountType('none'); setDiscountValue('') }}>None</Button>
                  <Button variant={discountType === 'percent' ? 'default' : 'outline'} size="sm" className="h-8 text-xs flex-1"
                    onClick={() => setDiscountType('percent')}>% Percent</Button>
                  <Button variant={discountType === 'flat' ? 'default' : 'outline'} size="sm" className="h-8 text-xs flex-1"
                    onClick={() => setDiscountType('flat')}>₹ Flat</Button>
                </div>
                {discountType !== 'none' && (
                  <div className="flex gap-2">
                    <Input type="number" placeholder={discountType === 'percent' ? '%' : '₹ amount'}
                      value={discountValue} onChange={e => { setDiscountValue(e.target.value); setDiscountPinVerified(false) }}
                      className="h-8 text-sm flex-1" />
                    <Input placeholder="Reason" value={discountReason}
                      onChange={e => setDiscountReason(e.target.value)} className="h-8 text-sm flex-1" />
                  </div>
                )}
                {needsDiscountAuth && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />PIN required ({effectiveDiscountPercent.toFixed(0)}% &gt; {discountMaxPercent}%)
                  </p>
                )}
              </div>
            </details>

            {/* Payment Mode */}
            {!payLaterMode && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { mode: 'cash' as const, icon: Banknote, label: 'Cash' },
                    { mode: 'upi' as const, icon: Smartphone, label: 'UPI' },
                    { mode: 'card' as const, icon: CreditCard, label: 'Card' },
                    { mode: 'split' as const, icon: Split, label: 'Split' },
                    { mode: 'nc' as const, icon: Gift, label: 'NC' },
                  ].map(pm => (
                    <button key={pm.mode}
                      onClick={() => {
                        if (pm.mode === 'nc') { setNcDialogOpen(true); setNcReason(''); setNcPin(''); return }
                        if (pm.mode === 'split') {
                          setPaymentMode('split'); setReferenceNumber('')
                          if (splitPayments.length === 0) setSplitPayments([
                            { mode: 'cash', amount: '', reference_number: '' },
                            { mode: 'upi', amount: '', reference_number: '' },
                          ])
                          return
                        }
                        setPaymentMode(pm.mode); setSplitPayments([]); setReferenceNumber('')
                      }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium ${
                        paymentMode === pm.mode
                          ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200'
                          : 'border-gray-150 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <pm.icon className="h-5 w-5" />
                      {pm.label}
                    </button>
                  ))}
                </div>

                {/* UPI/Card ref */}
                {(paymentMode === 'upi' || paymentMode === 'card') && (
                  <Input placeholder={`${paymentMode === 'upi' ? 'UPI' : 'Card'} reference${requirePaymentRef ? ' *' : ''}`}
                    value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className="h-9" />
                )}

                {/* Split details */}
                {paymentMode === 'split' && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium">Split Payments</span>
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addSplitPayment}>+ Add</Button>
                    </div>
                    {splitPayments.map((payment, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <select value={payment.mode} onChange={e => updateSplitPayment(index, 'mode', e.target.value)}
                            className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white">
                            <option value="cash">Cash</option><option value="upi">UPI</option>
                            <option value="card">Card</option><option value="nc">NC</option>
                          </select>
                          <Input type="number" placeholder="Amount" value={payment.amount}
                            onChange={e => updateSplitPayment(index, 'amount', e.target.value)} className="flex-1 h-8 text-xs" />
                          <button onClick={() => removeSplitPayment(index)}
                            className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50">
                            <X className="h-3 w-3" /></button>
                        </div>
                        {(payment.mode === 'upi' || payment.mode === 'card') && (
                          <Input placeholder={`Ref #${requirePaymentRef ? ' *' : ''}`} value={payment.reference_number}
                            onChange={e => updateSplitPayment(index, 'reference_number', e.target.value)} className="h-7 text-xs" />
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-2 border-t border-gray-200">
                      <span>Remaining</span>
                      <span className={`font-semibold ${splitRemaining > 0.5 ? 'text-red-500' : 'text-green-500'}`}>
                        ₹{splitRemaining.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pay Later */}
            {payLaterMode && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 space-y-2">
                <p className="text-xs font-medium text-amber-700 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pay Later</p>
                <Input type="number" placeholder="Amount paying now (0 = fully outstanding)"
                  value={partialAmount} onChange={e => setPartialAmount(e.target.value)} className="h-9" />
                {(parseFloat(partialAmount) || 0) > 0 && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYMENT_MODES.map(pm => (
                        <Button key={pm.value} variant={paymentMode === pm.value ? 'default' : 'outline'}
                          size="sm" className="h-8 text-xs" onClick={() => setPaymentMode(pm.value as PaymentMode)}>{pm.label}</Button>
                      ))}
                    </div>
                    {(paymentMode === 'upi' || paymentMode === 'card') && (
                      <Input placeholder={`Ref #${requirePaymentRef ? ' *' : ''}`}
                        value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className="h-8 text-sm" />
                    )}
                  </div>
                )}
                <p className="text-xs text-amber-600">Outstanding: ₹{(total - (parseFloat(partialAmount) || 0)).toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* ── STICKY FOOTER ── */}
          <div className="px-4 py-3 border-t bg-gray-50/80 shrink-0 space-y-2.5">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-10 flex-1 text-sm font-medium"
                onClick={() => { setPayLaterMode(!payLaterMode); if (!payLaterMode) { setPaymentMode(''); setPartialAmount('') } }}>
                <Clock className="h-4 w-4 mr-1.5" />{payLaterMode ? 'Full Pay' : 'Pay Later'}
              </Button>
              <Button variant="outline" size="sm" className="h-10 flex-1 text-sm font-medium" onClick={printPreviewBill} disabled={printing}>
                <Printer className="h-4 w-4 mr-1.5" />{printing ? '...' : 'Print'}
              </Button>
            </div>
            <Button className="w-full h-13 text-base font-bold bg-green-600 hover:bg-green-700 rounded-xl shadow-lg shadow-green-600/25 tracking-wide"
              onClick={settleBill} disabled={settling || (!payLaterMode && !paymentMode)}>
              {settling ? 'Settling...' : payLaterMode
                ? `Create Bill — ₹${total.toFixed(2)}`
                : `Settle — ₹${total.toFixed(2)}`}
            </Button>
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
      {/* NC (No Charge) Authorization Dialog */}
      <Dialog open={ncDialogOpen} onOpenChange={setNcDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600" />
              No Charge (NC)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Mark order <strong>{order?.order_number}</strong> as complimentary (₹{total.toFixed(2)}).
            </p>
            <div className="space-y-2">
              <Label>Reason for NC *</Label>
              <Textarea
                placeholder="e.g., Owner's guest, Staff meal, Customer complaint resolution..."
                value={ncReason}
                onChange={(e) => setNcReason(e.target.value)}
                rows={2}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Security PIN</Label>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={ncPin}
                onChange={(e) => setNcPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmNcPayment()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNcDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={confirmNcPayment}
                disabled={ncVerifying || !ncReason.trim()}
              >
                {ncVerifying ? 'Verifying...' : 'Authorize NC'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
