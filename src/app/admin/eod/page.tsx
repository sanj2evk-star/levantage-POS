'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { DailyClosing, Refund, Payment } from '@/types/database'
import { DENOMINATIONS } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  IndianRupee,
  ShoppingBag,
  Banknote,
  Smartphone,
  CreditCard,
  Calendar,
  Lock,
  History,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ViewTab = 'close_day' | 'history'

interface DaySummary {
  totalSales: number
  totalOrders: number
  cashTotal: number
  upiTotal: number
  cardTotal: number
  refundTotal: number
  cashRefundTotal: number
  outstandingTotal: number
}

interface ClosingWithCloser extends Omit<DailyClosing, 'closer'> {
  closer?: { name: string } | null
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EODPage() {
  const { profile } = useAuth(['admin', 'manager', 'cashier'])

  // View toggle
  const [activeTab, setActiveTab] = useState<ViewTab>('close_day')

  // Close Day state
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [denominations, setDenominations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    DENOMINATIONS.forEach(d => { init[String(d.value)] = 0 })
    return init
  })
  const [notes, setNotes] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [gapWarning, setGapWarning] = useState<string | null>(null)

  // History state
  const [historyLoading, setHistoryLoading] = useState(false)
  const [closings, setClosings] = useState<ClosingWithCloser[]>([])
  const [expandedClosingId, setExpandedClosingId] = useState<string | null>(null)

  // Computed values
  const actualCash = DENOMINATIONS.reduce(
    (sum, d) => sum + (denominations[String(d.value)] || 0) * d.value,
    0
  )
  const expectedCash = summary
    ? openingBalance + summary.cashTotal - summary.cashRefundTotal
    : 0
  const shortSurplus = actualCash - expectedCash

  // Load day summary
  const loadDaySummary = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const startOfDay = new Date(selectedDate + 'T00:00:00').toISOString()
    const endOfDay = new Date(selectedDate + 'T23:59:59').toISOString()

    const [billsResult, refundsResult, partialResult, lastClosingResult] = await Promise.all([
      supabase
        .from('bills')
        .select('*, payments(*)')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      supabase
        .from('refunds')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('bills')
        .select('total, payments(amount)')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'partial'),
      supabase
        .from('daily_closings')
        .select('actual_cash, date')
        .lt('date', selectedDate)
        .order('date', { ascending: false })
        .limit(1)
        .single(),
    ])

    const bills = billsResult.data || []
    const refunds = (refundsResult.data || []) as Refund[]
    const partialBills = partialResult.data || []

    // Payment breakdown
    let cashTotal = 0
    let upiTotal = 0
    let cardTotal = 0
    bills.forEach((bill: any) => {
      if (bill.payments) {
        bill.payments.forEach((p: Payment) => {
          switch (p.mode) {
            case 'cash': cashTotal += Number(p.amount); break
            case 'upi': upiTotal += Number(p.amount); break
            case 'card': cardTotal += Number(p.amount); break
          }
        })
      }
    })

    const totalSales = bills.reduce((sum: number, b: any) => sum + Number(b.total), 0)
    const refundTotal = refunds.reduce((sum, r) => sum + Number(r.amount), 0)
    const cashRefundTotal = refunds
      .filter(r => r.refund_mode === 'cash')
      .reduce((sum, r) => sum + Number(r.amount), 0)

    // Outstanding from partial bills
    const outstandingTotal = partialBills.reduce((sum: number, b: any) => {
      const paid = (b.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
      return sum + (Number(b.total) - paid)
    }, 0)

    setSummary({
      totalSales,
      totalOrders: bills.length,
      cashTotal,
      upiTotal,
      cardTotal,
      refundTotal,
      cashRefundTotal,
      outstandingTotal,
    })

    // Set opening balance from last closing
    if (lastClosingResult.data) {
      setOpeningBalance(Number(lastClosingResult.data.actual_cash))
    } else {
      setOpeningBalance(0)
    }

    // Check for gaps
    const { data: lastClosingForGap } = await supabase
      .from('daily_closings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (lastClosingForGap) {
      const lastDate = new Date(lastClosingForGap.date)
      const selectedDateObj = new Date(selectedDate)
      const diffDays = Math.floor(
        (selectedDateObj.getTime() - lastDate.getTime()) / 86400000
      )
      if (diffDays > 1) {
        const missedDates: string[] = []
        for (let i = 1; i < diffDays; i++) {
          const d = new Date(lastDate)
          d.setDate(d.getDate() + i)
          missedDates.push(formatDate(d))
        }
        setGapWarning(
          `There are ${diffDays - 1} unclosed day(s) before this date: ${missedDates.slice(0, 3).join(', ')}${missedDates.length > 3 ? '...' : ''}. Please close them first.`
        )
      } else {
        setGapWarning(null)
      }
    } else {
      setGapWarning(null)
    }

    setLoading(false)
  }, [selectedDate])

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('daily_closings')
      .select('*, closer:profiles!closed_by(name)')
      .order('date', { ascending: false })
      .limit(30)

    if (error) {
      toast.error('Failed to load history: ' + error.message)
    } else {
      setClosings((data || []) as ClosingWithCloser[])
    }
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'close_day') {
      loadDaySummary()
    } else {
      loadHistory()
    }
  }, [activeTab, loadDaySummary, loadHistory])

  // Reset denomination counts when date changes
  useEffect(() => {
    const init: Record<string, number> = {}
    DENOMINATIONS.forEach(d => { init[String(d.value)] = 0 })
    setDenominations(init)
    setNotes('')
  }, [selectedDate])

  function updateDenomination(key: string, count: number) {
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, count) }))
  }

  async function handleCloseDay() {
    if (!profile || !summary) return
    setClosing(true)
    const supabase = createClient()

    // Check for existing closing
    const { data: existing } = await supabase
      .from('daily_closings')
      .select('id')
      .eq('date', selectedDate)
      .single()

    if (existing) {
      toast.error('This date has already been closed')
      setClosing(false)
      setConfirmDialogOpen(false)
      return
    }

    // Check for gaps
    if (gapWarning) {
      toast.error('Please close the preceding unclosed days first')
      setClosing(false)
      setConfirmDialogOpen(false)
      return
    }

    const { error } = await supabase.from('daily_closings').insert({
      date: selectedDate,
      total_sales: summary.totalSales,
      total_orders: summary.totalOrders,
      cash_total: summary.cashTotal,
      upi_total: summary.upiTotal,
      card_total: summary.cardTotal,
      opening_balance: openingBalance,
      actual_cash: actualCash,
      denomination_details: denominations,
      short_surplus: shortSurplus,
      expected_cash: expectedCash,
      cash_refunds: summary.cashRefundTotal,
      refund_total: summary.refundTotal,
      partial_outstanding: summary.outstandingTotal,
      notes: notes || null,
      closed_by: profile.id,
    })

    if (error) {
      toast.error('Failed to close day: ' + error.message)
    } else {
      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'daily_closing',
        performed_by: profile.id,
        details: { date: selectedDate, total_sales: summary.totalSales, short_surplus: shortSurplus },
      }).then(() => {})

      toast.success(`Day closed successfully for ${selectedDate}`)
      setConfirmDialogOpen(false)
    }
    setClosing(false)
  }

  if (loading && activeTab === 'close_day') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold">End of Day</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'close_day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('close_day')}
          >
            <Lock className="h-4 w-4 mr-1" />
            Close Day
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
        </div>
      </div>

      {/* ========== CLOSE DAY VIEW ========== */}
      {activeTab === 'close_day' && summary && (
        <div className="space-y-6">
          {/* Date Selector */}
          <div className="flex items-center gap-3">
            <Label htmlFor="eod-date" className="font-medium">Date</Label>
            <Input
              id="eod-date"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-44"
              max={formatDate(new Date())}
            />
          </div>

          {/* Gap Warning */}
          {gapWarning && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">{gapWarning}</p>
            </div>
          )}

          {/* Day Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Day Summary - {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Sales</p>
                  <p className="text-xl font-bold">₹{summary.totalSales.toFixed(0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                  <p className="text-xl font-bold">{summary.totalOrders}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Refunds</p>
                  <p className="text-xl font-bold text-red-600">₹{summary.refundTotal.toFixed(0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Outstanding</p>
                  <p className="text-xl font-bold text-orange-600">₹{summary.outstandingTotal.toFixed(0)}</p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Payment Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Banknote className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Cash</p>
                    <p className="text-lg font-bold text-green-700">₹{summary.cashTotal.toFixed(0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">UPI</p>
                    <p className="text-lg font-bold text-blue-700">₹{summary.upiTotal.toFixed(0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500">Card</p>
                    <p className="text-lg font-bold text-purple-700">₹{summary.cardTotal.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opening Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Opening Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Label htmlFor="opening-balance" className="whitespace-nowrap text-sm">
                  Opening Cash (₹)
                </Label>
                <Input
                  id="opening-balance"
                  type="number"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(Number(e.target.value) || 0)}
                  className="w-40"
                  min={0}
                />
                <span className="text-xs text-gray-400">
                  Auto-suggested from previous day&apos;s actual cash
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Denomination Entry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Cash Denomination Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Denomination</th>
                      <th className="pb-2 font-medium text-center w-32">Count</th>
                      <th className="pb-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMINATIONS.map(d => {
                      const key = String(d.value)
                      const count = denominations[key] || 0
                      const subtotal = count * d.value
                      return (
                        <tr key={d.value} className="border-b last:border-0">
                          <td className="py-2 font-medium">{d.label}</td>
                          <td className="py-2 text-center">
                            <Input
                              type="number"
                              value={count || ''}
                              onChange={e =>
                                updateDenomination(key, parseInt(e.target.value) || 0)
                              }
                              className="w-24 mx-auto text-center"
                              min={0}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 text-right font-mono">
                            {subtotal > 0 ? `₹${subtotal.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2">
                      <td className="pt-3 font-bold" colSpan={2}>Total Cash Counted</td>
                      <td className="pt-3 text-right font-bold text-lg">
                        ₹{actualCash.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Reconciliation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Cash Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">Opening Balance</span>
                  <span className="font-medium">₹{openingBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">+ Cash Sales</span>
                  <span className="font-medium text-green-700">
                    +₹{summary.cashTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">- Cash Refunds</span>
                  <span className="font-medium text-red-600">
                    -₹{summary.cashRefundTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="font-semibold">Expected Cash</span>
                  <span className="font-bold text-lg">
                    ₹{expectedCash.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-semibold">Actual Cash (Counted)</span>
                  <span className="font-bold text-lg">
                    ₹{actualCash.toLocaleString('en-IN')}
                  </span>
                </div>
                <Separator />
                <div
                  className={cn(
                    'flex justify-between items-center py-3 px-4 rounded-lg',
                    shortSurplus < 0
                      ? 'bg-red-50 border border-red-200'
                      : shortSurplus > 0
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                  )}
                >
                  <span className="font-semibold">
                    {shortSurplus < 0 ? 'Short' : shortSurplus > 0 ? 'Surplus' : 'Exact Match'}
                  </span>
                  <span
                    className={cn(
                      'font-bold text-xl',
                      shortSurplus < 0
                        ? 'text-red-600'
                        : shortSurplus > 0
                          ? 'text-green-600'
                          : 'text-gray-700'
                    )}
                  >
                    {shortSurplus < 0 ? '-' : shortSurplus > 0 ? '+' : ''}₹
                    {Math.abs(shortSurplus).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-6">
                <Label htmlFor="eod-notes" className="text-sm font-medium mb-2 block">
                  Notes (optional)
                </Label>
                <Textarea
                  id="eod-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any remarks about the day's cash, discrepancies, etc."
                  rows={3}
                />
              </div>

              {/* Close Day Button */}
              <div className="mt-6">
                <Button
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                  size="lg"
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={!!gapWarning}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Close Day
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== HISTORY VIEW ========== */}
      {activeTab === 'history' && (
        <div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
            </div>
          ) : closings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">No daily closings found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past Closings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium text-right">Sales</th>
                        <th className="pb-2 font-medium text-right">Orders</th>
                        <th className="pb-2 font-medium text-right">Cash</th>
                        <th className="pb-2 font-medium text-right">UPI</th>
                        <th className="pb-2 font-medium text-right">Card</th>
                        <th className="pb-2 font-medium text-right">Short/Surplus</th>
                        <th className="pb-2 font-medium">Closed By</th>
                        <th className="pb-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {closings.map(c => {
                        const isExpanded = expandedClosingId === c.id
                        const denomDetail = c.denomination_details || {}
                        return (
                          <tr key={c.id} className="border-b last:border-0 group">
                            <td colSpan={9} className="p-0">
                              {/* Main row */}
                              <button
                                onClick={() =>
                                  setExpandedClosingId(isExpanded ? null : c.id)
                                }
                                className="w-full flex items-center text-left py-2.5 px-0 hover:bg-gray-50 transition-colors"
                              >
                                <span className="flex-1 grid grid-cols-9 items-center text-sm">
                                  <span className="font-medium">
                                    {new Date(c.date + 'T12:00:00').toLocaleDateString(
                                      'en-IN',
                                      { day: 'numeric', month: 'short', year: '2-digit' }
                                    )}
                                  </span>
                                  <span className="text-right font-semibold">
                                    ₹{Number(c.total_sales).toFixed(0)}
                                  </span>
                                  <span className="text-right">{c.total_orders}</span>
                                  <span className="text-right">₹{Number(c.cash_total).toFixed(0)}</span>
                                  <span className="text-right">₹{Number(c.upi_total).toFixed(0)}</span>
                                  <span className="text-right">₹{Number(c.card_total).toFixed(0)}</span>
                                  <span className="text-right">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        Number(c.short_surplus) < 0
                                          ? 'border-red-300 text-red-600'
                                          : Number(c.short_surplus) > 0
                                            ? 'border-green-300 text-green-600'
                                            : 'border-gray-300 text-gray-600'
                                      )}
                                    >
                                      {Number(c.short_surplus) < 0
                                        ? `-₹${Math.abs(Number(c.short_surplus))}`
                                        : Number(c.short_surplus) > 0
                                          ? `+₹${Number(c.short_surplus)}`
                                          : 'Exact'}
                                    </Badge>
                                  </span>
                                  <span className="text-gray-500 text-xs">
                                    {c.closer?.name || '-'}
                                  </span>
                                  <span className="text-right">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 inline text-gray-400" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 inline text-gray-400" />
                                    )}
                                  </span>
                                </span>
                              </button>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="px-4 pb-4 bg-gray-50 border-t">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4">
                                    {/* Denomination breakdown */}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                        Denomination Breakdown
                                      </p>
                                      <table className="w-full text-xs">
                                        <tbody>
                                          {DENOMINATIONS.map(d => {
                                            const count =
                                              denomDetail[String(d.value)] || 0
                                            if (count === 0) return null
                                            return (
                                              <tr
                                                key={d.value}
                                                className="border-b last:border-0"
                                              >
                                                <td className="py-1">{d.label}</td>
                                                <td className="py-1 text-center">
                                                  x {count}
                                                </td>
                                                <td className="py-1 text-right font-mono">
                                                  ₹{(count * d.value).toLocaleString('en-IN')}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Summary details */}
                                    <div className="space-y-2 text-xs">
                                      <p className="font-semibold text-gray-500 uppercase mb-2">
                                        Reconciliation Details
                                      </p>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Opening Balance</span>
                                        <span>₹{Number(c.opening_balance).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Expected Cash</span>
                                        <span>₹{Number(c.expected_cash).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Actual Cash</span>
                                        <span>₹{Number(c.actual_cash).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Cash Refunds</span>
                                        <span className="text-red-600">
                                          -₹{Number(c.cash_refunds).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Total Refunds</span>
                                        <span className="text-red-600">
                                          -₹{Number(c.refund_total).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Outstanding</span>
                                        <span className="text-orange-600">
                                          ₹{Number(c.partial_outstanding).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      {c.notes && (
                                        <div className="mt-3 pt-3 border-t">
                                          <p className="text-gray-500 mb-1">Notes:</p>
                                          <p className="text-gray-700">{c.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Day Closing</DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                You are about to close the day for{' '}
                <span className="font-semibold text-gray-900">{selectedDate}</span>.
                This action cannot be undone.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Sales</span>
                  <span className="font-bold">₹{summary.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Orders</span>
                  <span className="font-bold">{summary.totalOrders}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-500">Expected Cash</span>
                  <span>₹{expectedCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Actual Cash</span>
                  <span>₹{actualCash.toFixed(2)}</span>
                </div>
                <div
                  className={cn(
                    'flex justify-between font-semibold',
                    shortSurplus < 0
                      ? 'text-red-600'
                      : shortSurplus > 0
                        ? 'text-green-600'
                        : 'text-gray-700'
                  )}
                >
                  <span>{shortSurplus < 0 ? 'Short' : shortSurplus > 0 ? 'Surplus' : 'Match'}</span>
                  <span>
                    {shortSurplus !== 0
                      ? `${shortSurplus < 0 ? '-' : '+'}₹${Math.abs(shortSurplus).toFixed(2)}`
                      : '₹0.00'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmDialogOpen(false)}
                  disabled={closing}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCloseDay}
                  disabled={closing}
                >
                  {closing ? 'Closing...' : 'Confirm Close'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
