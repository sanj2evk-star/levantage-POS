'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bill, RefundMode } from '@/types/database'
import { openCashDrawer } from '@/lib/utils/print'
import { PAYMENT_MODES } from '@/lib/constants'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RotateCcw, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface RefundDialogProps {
  bill: Bill
  order: { id: string; order_number: string; table?: { number: number; section: string } | null }
  open: boolean
  onClose: () => void
  onRefunded: () => void
  verifyPassword: (password: string) => Promise<boolean>
}

export function RefundDialog({ bill, order, open, onClose, onRefunded, verifyPassword }: RefundDialogProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundMode, setRefundMode] = useState<RefundMode>('cash')
  const [refundReference, setRefundReference] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [processing, setProcessing] = useState(false)

  const maxRefund = Number(bill.total) - Number(bill.total_refunded || 0)
  const actualRefundAmount = refundType === 'full' ? maxRefund : Math.min(parseFloat(refundAmount) || 0, maxRefund)

  async function processRefund() {
    if (!refundReason.trim()) {
      toast.error('Please enter a reason for the refund')
      return
    }
    if (refundType === 'partial' && actualRefundAmount <= 0) {
      toast.error('Please enter a valid refund amount')
      return
    }
    if (actualRefundAmount > maxRefund) {
      toast.error(`Refund cannot exceed ₹${maxRefund.toFixed(2)}`)
      return
    }

    setProcessing(true)

    // Verify PIN
    const valid = await verifyPassword(pinInput)
    if (!valid) {
      toast.error('Invalid PIN')
      setProcessing(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // Create refund record
      const { error: refundError } = await supabase.from('refunds').insert({
        bill_id: bill.id,
        amount: actualRefundAmount,
        reason: refundReason.trim(),
        refund_mode: refundMode,
        reference_number: (refundMode === 'upi' || refundMode === 'card') && refundReference.trim()
          ? refundReference.trim() : null,
        performed_by: user?.id || null,
      })

      if (refundError) {
        toast.error('Failed to create refund: ' + refundError.message)
        setProcessing(false)
        return
      }

      // Update bill's total_refunded
      const newTotalRefunded = Number(bill.total_refunded || 0) + actualRefundAmount
      await supabase
        .from('bills')
        .update({ total_refunded: newTotalRefunded })
        .eq('id', bill.id)

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'refund',
        order_id: order.id,
        bill_id: bill.id,
        performed_by: user?.id || null,
        details: {
          bill_number: bill.bill_number,
          order_number: order.order_number,
          table: order.table ? getTableDisplayName(order.table) : 'Takeaway',
          refund_amount: actualRefundAmount,
          refund_mode: refundMode,
          reason: refundReason.trim(),
          refund_type: refundType,
          total_refunded_after: newTotalRefunded,
          bill_total: bill.total,
        },
      })

      // Open cash drawer if cash refund
      if (refundMode === 'cash') {
        openCashDrawer().catch(() => {})
      }

      toast.success(`Refund of ₹${actualRefundAmount.toFixed(2)} processed`)
      onRefunded()
    } catch (err) {
      toast.error('Failed to process refund')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-500" />
            Refund - {bill.bill_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Bill summary */}
          <div className="bg-gray-50 dark:bg-neutral-700 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-neutral-400">Bill Total</span>
              <span className="font-medium">₹{Number(bill.total).toFixed(2)}</span>
            </div>
            {Number(bill.total_refunded || 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Already Refunded</span>
                <span>₹{Number(bill.total_refunded).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Max Refundable</span>
              <span>₹{maxRefund.toFixed(2)}</span>
            </div>
          </div>

          {/* Refund type */}
          <div className="space-y-2">
            <Label className="text-sm">Refund Type</Label>
            <div className="flex gap-2">
              <Button
                variant={refundType === 'full' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setRefundType('full')}
              >
                Full Refund
              </Button>
              <Button
                variant={refundType === 'partial' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setRefundType('partial')}
              >
                Partial Refund
              </Button>
            </div>
          </div>

          {/* Partial amount */}
          {refundType === 'partial' && (
            <div className="space-y-1">
              <Label className="text-sm">Refund Amount</Label>
              <Input
                type="number"
                placeholder={`Max ₹${maxRefund.toFixed(2)}`}
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1">
            <Label className="text-sm">Reason *</Label>
            <Textarea
              placeholder="e.g., Customer complaint, Wrong order..."
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Refund mode */}
          <div className="space-y-2">
            <Label className="text-sm">Refund To</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map(pm => (
                <Button
                  key={pm.value}
                  variant={refundMode === pm.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRefundMode(pm.value as RefundMode)}
                >
                  {pm.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Reference number */}
          {(refundMode === 'upi' || refundMode === 'card') && (
            <Input
              placeholder={`${refundMode === 'upi' ? 'UPI' : 'Card'} refund reference`}
              value={refundReference}
              onChange={e => setRefundReference(e.target.value)}
            />
          )}

          <Separator />

          {/* PIN */}
          <div className="space-y-1">
            <Label className="text-sm flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Security PIN
            </Label>
            <Input
              type="password"
              placeholder="Enter PIN to authorize refund"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && processRefund()}
            />
          </div>

          {/* Refund amount summary */}
          {actualRefundAmount > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
              <p className="text-sm text-red-600">Refund Amount</p>
              <p className="text-2xl font-bold text-red-700">₹{actualRefundAmount.toFixed(2)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={processRefund}
              disabled={processing || !refundReason.trim() || actualRefundAmount <= 0}
            >
              {processing ? 'Processing...' : 'Process Refund'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
