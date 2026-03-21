'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PrintJobRecord {
  id: string
  type: 'kot' | 'bill' | 'open_drawer' | 'test'
  printer_ip: string
  printer_port: number
  payload: Record<string, unknown>
  status: 'pending' | 'printing' | 'printed' | 'failed'
  error: string | null
  created_at: string
  printed_at: string | null
}

export interface PrintMonitorState {
  failedJobs: PrintJobRecord[]
  staleJobs: PrintJobRecord[]
  pendingCount: number
  hasIssue: boolean
  proxyMayBeDown: boolean
  lastUpdated: Date | null
  loading: boolean
}

const STALE_THRESHOLD_MS = 60_000 // 60 seconds
const POLL_INTERVAL_MS = 15_000   // poll every 15 seconds
const PROXY_DOWN_STALE_COUNT = 3  // 3+ stale jobs = proxy likely down
const DISMISSED_STORAGE_KEY = 'print-monitor-dismissed'

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { ids: string[], at: number }
    // Expire dismissed list after 12 hours
    if (Date.now() - parsed.at > 12 * 60 * 60 * 1000) {
      localStorage.removeItem(DISMISSED_STORAGE_KEY)
      return new Set()
    }
    return new Set(parsed.ids)
  } catch {
    return new Set()
  }
}

function addDismissedId(jobId: string) {
  const existing = getDismissedIds()
  existing.add(jobId)
  localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({
    ids: Array.from(existing),
    at: Date.now(),
  }))
}

export function usePrintMonitoring() {
  const [state, setState] = useState<PrintMonitorState>({
    failedJobs: [],
    staleJobs: [],
    pendingCount: 0,
    hasIssue: false,
    proxyMayBeDown: false,
    lastUpdated: null,
    loading: true,
  })
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load dismissed set from localStorage on mount
  useEffect(() => {
    setDismissedIds(getDismissedIds())
  }, [])

  const loadPrintStatus = useCallback(async () => {
    const supabase = createClient()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

    // Fetch failed jobs from last 24 hours
    const { data: failed } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    // Fetch stale pending jobs (pending > 60 seconds)
    const { data: stale } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', staleThreshold)
      .order('created_at', { ascending: false })
      .limit(20)

    // Count all currently pending
    const { count } = await supabase
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    const failedJobs = (failed || []) as PrintJobRecord[]
    const staleJobs = (stale || []) as PrintJobRecord[]
    const pendingCount = count || 0

    setState({
      failedJobs,
      staleJobs,
      pendingCount,
      hasIssue: failedJobs.length > 0 || staleJobs.length > 0,
      proxyMayBeDown: staleJobs.length >= PROXY_DOWN_STALE_COUNT,
      lastUpdated: new Date(),
      loading: false,
    })
  }, [])

  // Retry a failed job by creating a fresh copy — original row untouched
  const retryJob = useCallback(async (job: PrintJobRecord) => {
    const supabase = createClient()
    const { error } = await supabase.from('print_jobs').insert({
      type: job.type,
      printer_ip: job.printer_ip,
      printer_port: job.printer_port,
      payload: job.payload,
      // status defaults to 'pending' via DB default
    })

    if (error) {
      return false
    }

    // Reload to reflect new state
    await loadPrintStatus()
    return true
  }, [loadPrintStatus])

  // Dismiss a job — UI-only via localStorage, no DB mutation
  const dismissJob = useCallback((jobId: string) => {
    addDismissedId(jobId)
    setDismissedIds(prev => new Set(prev).add(jobId))
  }, [])

  useEffect(() => {
    loadPrintStatus()
    intervalRef.current = setInterval(loadPrintStatus, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadPrintStatus])

  // Filter out dismissed jobs for the consumer
  const visibleFailedJobs = state.failedJobs.filter(j => !dismissedIds.has(j.id))
  const visibleStaleJobs = state.staleJobs.filter(j => !dismissedIds.has(j.id))
  const visibleHasIssue = visibleFailedJobs.length > 0 || visibleStaleJobs.length > 0

  return {
    ...state,
    failedJobs: visibleFailedJobs,
    staleJobs: visibleStaleJobs,
    hasIssue: visibleHasIssue,
    retryJob,
    dismissJob,
    refresh: loadPrintStatus,
  }
}
