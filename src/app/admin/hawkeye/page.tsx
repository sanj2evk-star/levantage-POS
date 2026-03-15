'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { getBusinessDayRange, getCurrentBusinessDate, loadDayBoundaryHour } from '@/lib/utils/business-day'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Eye,
  Trash2,
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Clock,
  Wallet,
  CalendarCheck,
} from 'lucide-react'

type AuditAction = 'item_cancel' | 'bill_reprint' | 'refund' | 'partial_payment' | 'balance_collected' | 'daily_closing'

interface AuditLog {
  id: string
  action: AuditAction
  order_id: string | null
  bill_id: string | null
  performed_by: string | null
  details: {
    item_name?: string
    reason?: string
    order_number?: string
    table?: string
    bill_number?: string
    total?: number
    refund_amount?: number
    refund_mode?: string
    refund_type?: string
    amount_paid?: number
    balance_remaining?: number
    payment_mode?: string
    date?: string
    total_sales?: number
    total_orders?: number
  }
  created_at: string
  performer?: { name: string } | null
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmtTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const fmtDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function HawkEyePage() {
  const { profile } = useAuth(['admin'])
  const [selectedDate, setSelectedDate] = useState(() => getCurrentBusinessDate(3))
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | AuditAction>('all')

  const changeDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(fmtDate(d))
  }

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const bh = await loadDayBoundaryHour(supabase)
    const { start: startISO, end: endISO } = getBusinessDayRange(selectedDate, bh)

    const { data } = await supabase
      .from('audit_logs')
      .select('*, performer:profiles!performed_by(name)')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })

    setLogs((data || []) as unknown as AuditLog[])
    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.action === filter)

  const cancelCount = logs.filter(l => l.action === 'item_cancel').length
  const reprintCount = logs.filter(l => l.action === 'bill_reprint').length
  const refundCount = logs.filter(l => l.action === 'refund').length
  const partialCount = logs.filter(l => l.action === 'partial_payment' || l.action === 'balance_collected').length

  if (!profile) return null

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6 text-red-600" />
          Hawk Eye
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-neutral-500" />
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
            className={selectedDate === fmtDate(new Date()) ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300' : ''}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card className={cancelCount > 0 ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="h-4 w-4 text-red-500" />
              <p className="text-xs text-gray-500 dark:text-neutral-400">Cancelled</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{cancelCount}</p>
          </CardContent>
        </Card>
        <Card className={reprintCount > 0 ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Printer className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-gray-500 dark:text-neutral-400">Reprinted</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{reprintCount}</p>
          </CardContent>
        </Card>
        <Card className={refundCount > 0 ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-gray-500 dark:text-neutral-400">Refunds</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">{refundCount}</p>
          </CardContent>
        </Card>
        <Card className={partialCount > 0 ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-gray-500 dark:text-neutral-400">Partial/Balance</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{partialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
              <p className="text-xs text-gray-500 dark:text-neutral-400">Total Flags</p>
            </div>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-4 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'all' ? 'bg-white dark:bg-neutral-900 shadow text-gray-900 dark:text-neutral-100' : 'text-gray-600 dark:text-neutral-400'
          }`}
        >
          All ({logs.length})
        </button>
        <button
          onClick={() => setFilter('item_cancel')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'item_cancel' ? 'bg-white dark:bg-neutral-900 shadow text-red-700' : 'text-gray-600 dark:text-neutral-400'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Cancels ({cancelCount})
        </button>
        <button
          onClick={() => setFilter('bill_reprint')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'bill_reprint' ? 'bg-white dark:bg-neutral-900 shadow text-amber-700' : 'text-gray-600 dark:text-neutral-400'
          }`}
        >
          <Printer className="h-3.5 w-3.5" />
          Reprints ({reprintCount})
        </button>
        <button
          onClick={() => setFilter('refund')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            filter === 'refund' ? 'bg-white dark:bg-neutral-900 shadow text-orange-700' : 'text-gray-600 dark:text-neutral-400'
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refunds ({refundCount})
        </button>
      </div>

      {/* Logs */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-700" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-neutral-400">
              <Eye className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No flags for this date</p>
              <p className="text-xs mt-1">All clear!</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-neutral-700">
              {filteredLogs.map((log) => {
                const actionConfig: Record<AuditAction, { bg: string; text: string; icon: typeof Trash2; label: string }> = {
                  item_cancel: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-600', icon: Trash2, label: 'Item Cancelled' },
                  bill_reprint: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600', icon: Printer, label: 'Bill Reprinted' },
                  refund: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600', icon: RotateCcw, label: 'Refund' },
                  partial_payment: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600', icon: Clock, label: 'Partial Payment' },
                  balance_collected: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-600', icon: Wallet, label: 'Balance Collected' },
                  daily_closing: { bg: 'bg-gray-100 dark:bg-neutral-800', text: 'text-gray-600 dark:text-neutral-400', icon: CalendarCheck, label: 'Day Closed' },
                }
                const cfg = actionConfig[log.action] || actionConfig.item_cancel
                const Icon = cfg.icon

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${cfg.bg} ${cfg.text}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-gray-400 dark:text-neutral-500">{fmtTime(log.created_at)}</span>
                        </div>

                        {log.action === 'item_cancel' && (
                          <>
                            <p className="text-sm font-medium">
                              {log.details.item_name}
                              <span className="text-gray-500 dark:text-neutral-400 font-normal"> — {log.details.order_number}</span>
                              {log.details.table && (
                                <span className="text-gray-400 dark:text-neutral-500 font-normal"> ({log.details.table})</span>
                              )}
                            </p>
                            {log.details.reason && (
                              <p className="text-sm text-red-600 mt-0.5">
                                Reason: {log.details.reason}
                              </p>
                            )}
                          </>
                        )}

                        {log.action === 'bill_reprint' && (
                          <p className="text-sm font-medium">
                            {log.details.bill_number}
                            <span className="text-gray-500 dark:text-neutral-400 font-normal"> — {log.details.order_number}</span>
                            {log.details.table && (
                              <span className="text-gray-400 dark:text-neutral-500 font-normal"> ({log.details.table})</span>
                            )}
                            {log.details.total != null && (
                              <span className="text-amber-700 font-normal"> — ₹{Number(log.details.total).toFixed(2)}</span>
                            )}
                          </p>
                        )}

                        {log.action === 'refund' && (
                          <>
                            <p className="text-sm font-medium">
                              {log.details.bill_number}
                              <span className="text-gray-500 dark:text-neutral-400 font-normal"> — {log.details.order_number}</span>
                              {log.details.table && (
                                <span className="text-gray-400 dark:text-neutral-500 font-normal"> ({log.details.table})</span>
                              )}
                              {log.details.refund_amount != null && (
                                <span className="text-orange-700 font-semibold"> — ₹{Number(log.details.refund_amount).toFixed(2)}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                              {log.details.refund_type === 'full' ? 'Full' : 'Partial'} refund via {log.details.refund_mode?.toUpperCase()}
                            </p>
                            {log.details.reason && (
                              <p className="text-sm text-orange-600 mt-0.5">
                                Reason: {log.details.reason}
                              </p>
                            )}
                          </>
                        )}

                        {log.action === 'partial_payment' && (
                          <p className="text-sm font-medium">
                            {log.details.bill_number}
                            <span className="text-gray-500 dark:text-neutral-400 font-normal"> — {log.details.order_number}</span>
                            {log.details.table && (
                              <span className="text-gray-400 dark:text-neutral-500 font-normal"> ({log.details.table})</span>
                            )}
                            {log.details.amount_paid != null && (
                              <span className="text-blue-700 font-normal"> — Paid ₹{Number(log.details.amount_paid).toFixed(2)}, Balance ₹{Number(log.details.balance_remaining).toFixed(2)}</span>
                            )}
                          </p>
                        )}

                        {log.action === 'balance_collected' && (
                          <p className="text-sm font-medium">
                            {log.details.bill_number}
                            <span className="text-gray-500 dark:text-neutral-400 font-normal"> — {log.details.order_number}</span>
                            {log.details.table && (
                              <span className="text-gray-400 dark:text-neutral-500 font-normal"> ({log.details.table})</span>
                            )}
                            {log.details.total != null && (
                              <span className="text-green-700 font-normal"> — ₹{Number(log.details.total).toFixed(2)} via {log.details.payment_mode?.toUpperCase()}</span>
                            )}
                          </p>
                        )}

                        {log.action === 'daily_closing' && (
                          <p className="text-sm font-medium">
                            Date: {log.details.date}
                            {log.details.total_sales != null && (
                              <span className="text-gray-500 dark:text-neutral-400 font-normal"> — Sales ₹{Number(log.details.total_sales).toFixed(0)}, {log.details.total_orders} orders</span>
                            )}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                          By: {log.performer?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
