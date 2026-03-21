'use client'

import { useState } from 'react'
import { usePrintMonitoring, PrintJobRecord } from '@/hooks/use-print-monitoring'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  X,
  Printer,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

function getJobLabel(job: PrintJobRecord): string {
  const payload = job.payload || {}
  const parts: string[] = []

  if (job.type === 'kot') parts.push('KOT')
  else if (job.type === 'bill') parts.push('Bill')
  else parts.push(job.type.toUpperCase())

  const kotNumber = payload.kotNumber as string | undefined
  const orderNumber = payload.orderNumber as string | undefined
  const billNumber = payload.billNumber as string | undefined

  if (kotNumber) parts.push(kotNumber)
  else if (billNumber) parts.push(`#${billNumber}`)
  else if (orderNumber) parts.push(orderNumber)

  const tableName = payload.tableName as string | undefined
  if (tableName) parts.push(`(${tableName})`)

  const stationName = payload.stationName as string | undefined
  if (stationName && job.type === 'kot') parts.push(`\u2192 ${stationName}`)

  return parts.join(' ')
}

function getJobStatusBadge(job: PrintJobRecord) {
  if (job.status === 'failed') {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5">Failed</Badge>
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5">Stuck</Badge>
}

export function PrintMonitorBanner() {
  const {
    failedJobs, staleJobs, pendingCount, hasIssue, proxyMayBeDown,
    lastUpdated, loading, retryJob, dismissJob, refresh,
  } = usePrintMonitoring()
  const [expanded, setExpanded] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  // Don't render if no issues or still loading on first render
  if (loading || !hasIssue) return null

  const allIssueJobs = [...failedJobs, ...staleJobs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Determine banner message
  let bannerMessage = 'Print issue detected \u2014 kitchen/bill printing may be affected'
  if (proxyMayBeDown) {
    bannerMessage = 'Print proxy may be offline or disconnected \u2014 printing is not working'
  }

  async function handleRetry(job: PrintJobRecord) {
    setRetrying(job.id)
    const ok = await retryJob(job)
    setRetrying(null)
    if (ok) {
      toast.success(`Retrying: ${getJobLabel(job)}`)
    } else {
      toast.error('Retry failed \u2014 check printer connection')
    }
  }

  function handleDismiss(job: PrintJobRecord) {
    dismissJob(job.id)
  }

  const latestFailed = failedJobs.length > 0 ? failedJobs[0] : null

  return (
    <div className="mx-3 sm:mx-6 mt-3">
      <div className={`rounded-lg border ${proxyMayBeDown ? 'border-red-400 dark:border-red-700 bg-red-100 dark:bg-red-950/50' : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'}`}>
        {/* Banner header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {proxyMayBeDown
            ? <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-red-800 dark:text-red-300">
              {bannerMessage}
            </span>
            {lastUpdated && (
              <span className="text-[10px] text-red-500 dark:text-red-500 ml-2">
                checked {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {failedJobs.length > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-1.5">
                {failedJobs.length} failed
              </Badge>
            )}
            {staleJobs.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-1.5">
                {staleJobs.length} stuck
              </Badge>
            )}
            {pendingCount > 0 && staleJobs.length === 0 && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5">
                {pendingCount} pending
              </Badge>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-600 dark:text-red-400"
              onClick={() => refresh()}
              title="Refresh print status"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-600 dark:text-red-400"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Show details'}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Latest failure summary (always visible when collapsed) */}
        {!expanded && latestFailed && (
          <div className="px-3 pb-2 text-xs text-red-700 dark:text-red-400">
            Latest failure: {getJobLabel(latestFailed)} &mdash; {formatDistanceToNow(new Date(latestFailed.created_at), { addSuffix: true })}
            {latestFailed.error && <span className="ml-1 opacity-75">({latestFailed.error})</span>}
          </div>
        )}

        {/* Expanded job list */}
        {expanded && (
          <div className="border-t border-red-200 dark:border-red-800 px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto">
            {allIssueJobs.length === 0 && (
              <p className="text-xs text-gray-500 py-2 text-center">No issues found</p>
            )}
            {allIssueJobs.map(job => (
              <div
                key={job.id}
                className="flex items-center gap-2 text-xs bg-white dark:bg-neutral-800 rounded px-2.5 py-2 border border-gray-200 dark:border-neutral-700"
              >
                <Printer className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getJobStatusBadge(job)}
                    <span className="font-medium text-gray-800 dark:text-neutral-200 truncate">
                      {getJobLabel(job)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-500 dark:text-neutral-400 flex-wrap">
                    <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                    <span>&middot;</span>
                    <span>{job.printer_ip}</span>
                    {job.error && (
                      <>
                        <span>&middot;</span>
                        <span className="text-red-600 dark:text-red-400 truncate">{job.error}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {job.status === 'failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleRetry(job)}
                      disabled={retrying === job.id}
                    >
                      <RotateCcw className={`h-3 w-3 mr-1 ${retrying === job.id ? 'animate-spin' : ''}`} />
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-gray-600"
                    onClick={() => handleDismiss(job)}
                    title="Dismiss this job"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
