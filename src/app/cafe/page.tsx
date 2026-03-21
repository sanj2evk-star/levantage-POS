'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { KOTEntry, OrderItem, Order } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Coffee,
  Clock,
  CheckCircle2,
  RefreshCw,
  Volume2,
  VolumeX,
  Bell,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { playBarNewOrderSound, unlockAudio, startAudioKeepAlive } from '@/lib/utils/notification-sound'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { getBusinessDayRange, getCurrentBusinessDate, loadDayBoundaryHour } from '@/lib/utils/business-day'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface KOTWithDetails extends KOTEntry {
  order: Order & {
    table: { number: number; section: string } | null
    waiter: { name: string } | null
    items: (OrderItem & {
      menu_item: { name: string; station: string }
    })[]
  }
}

export default function CafePage() {
  const [kots, setKots] = useState<KOTWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cafe-sound') !== '0'
    }
    return true
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [mounted, setMounted] = useState(false)
  const [newOrderPopup, setNewOrderPopup] = useState<KOTWithDetails[]>([])
  const prevPendingCountRef = useRef(0)
  const prevKotIdsRef = useRef<Set<string>>(new Set())
  const ringChannelRef = useRef<RealtimeChannel | null>(null)
  const readyAlertChannelRef = useRef<RealtimeChannel | null>(null)
  const soundEnabledRef = useRef(true)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Prevent hydration mismatch for theme
  useEffect(() => setMounted(true), [])

  // Check auth session - redirect to cafe login if not authenticated
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/cafe/login')
      } else {
        setAuthenticated(true)
      }
    })
  }, [router])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setNotifPermission)
      }
    }
  }, [])

  // Keep soundEnabledRef in sync
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Unlock Web Audio API on first user interaction + start keep-alive
  useEffect(() => {
    let stopKeepAlive: (() => void) | null = null
    function unlock() {
      unlockAudio()
      // Start keep-alive after first interaction to prevent Android from suspending AudioContext
      if (!stopKeepAlive) {
        stopKeepAlive = startAudioKeepAlive(20_000)
      }
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
      if (stopKeepAlive) stopKeepAlive()
    }
  }, [])

  // Subscribe to broadcast channels on mount (ring + ready alerts)
  useEffect(() => {
    const supabase = createClient()
    const ringCh = supabase.channel('waiter-ring').subscribe()
    const readyCh = supabase.channel('kot-ready-alert').subscribe()
    ringChannelRef.current = ringCh
    readyAlertChannelRef.current = readyCh

    return () => {
      supabase.removeChannel(ringCh)
      supabase.removeChannel(readyCh)
    }
  }, [])

  const loadKOTs = useCallback(async () => {
    const supabase = createClient()

    // Only show KOTs from the current business day (fresh start after day close)
    const bh = await loadDayBoundaryHour(supabase)
    const bizDate = getCurrentBusinessDate(bh)
    const { start: dayStart, end: dayEnd } = getBusinessDayRange(bizDate, bh)

    const { data, error: queryError } = await supabase
      .from('kot_entries')
      .select(`
        id, order_id, station, kot_number, status, created_at,
        order:orders!order_id(
          id, order_number, order_type, notes, waiter_id,
          table:tables!table_id(number, section),
          waiter:profiles!waiter_id(name),
          items:order_items(
            id, quantity, notes, station, is_cancelled, created_at,
            menu_item:menu_items(name, station)
          )
        )
      `)
      .eq('station', 'cafe')
      .in('status', ['pending', 'ready'])
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: true })

    if (queryError) {
      console.error('Cafe KOT query error:', queryError)
      setError(queryError.message)
      setLoading(false)
      return
    }

    if (data) {
      setError(null)
      let allKots = data as unknown as KOTWithDetails[]

      // Partition items per KOT: when multiple KOTs exist for the same order,
      // assign items to the KOT created closest before them (by created_at).
      const orderKotGroups = new Map<string, KOTWithDetails[]>()
      for (const kot of allKots) {
        const group = orderKotGroups.get(kot.order_id) || []
        group.push(kot)
        orderKotGroups.set(kot.order_id, group)
      }

      for (const [, group] of orderKotGroups) {
        if (group.length <= 1) continue
        const sorted = [...group].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const allItems = sorted[0].order.items.filter(
          (i: any) => i.station === sorted[0].station && !i.is_cancelled
        )
        allItems.sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        for (let idx = 0; idx < sorted.length; idx++) {
          const kotTime = new Date(sorted[idx].created_at).getTime()
          const nextKotTime = idx + 1 < sorted.length
            ? new Date(sorted[idx + 1].created_at).getTime()
            : Number.MAX_SAFE_INTEGER

          ;(sorted[idx].order as any).items = allItems.filter((item: any) => {
            const itemTime = new Date(item.created_at).getTime()
            return itemTime >= kotTime - 5000 && itemTime < nextKotTime - 5000
          })
        }
      }

      const pendingCount = allKots.filter(k => k.status === 'pending').length

      // Detect brand-new pending KOTs (not seen before)
      const currentPendingIds = new Set(allKots.filter(k => k.status === 'pending').map(k => k.id))
      const brandNewKots = allKots.filter(
        k => k.status === 'pending' && !prevKotIdsRef.current.has(k.id)
      )

      if (brandNewKots.length > 0 && prevKotIdsRef.current.size > 0) {
        if (soundEnabledRef.current) {
          playBarNewOrderSound()
        }
        // Show full-screen popup with the new orders
        setNewOrderPopup(prev => [...prev, ...brandNewKots])

        toast.info(`${brandNewKots.length} new order${brandNewKots.length > 1 ? 's' : ''} received!`, { duration: 4000 })
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New Cafe Order!', {
            body: `${brandNewKots.length} new order${brandNewKots.length > 1 ? 's' : ''} received`,
            icon: '/icons/icon-192.png',
            tag: 'new-cafe-kot',
          } as NotificationOptions)
        }
      }
      prevKotIdsRef.current = currentPendingIds
      prevPendingCountRef.current = pendingCount
      setKots(allKots)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadKOTs()

    const supabase = createClient()
    const channel = supabase
      .channel('cafe-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kot_entries' },
        () => loadKOTs()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => loadKOTs()
      )
      .subscribe()

    // Polling fallback every 30s — catches missed realtime events (WiFi drops, etc.)
    pollIntervalRef.current = setInterval(() => {
      loadKOTs()
    }, 30_000)

    // Re-fetch + re-unlock audio when tab comes back from background
    function handleVisibilityChange() {
      if (!document.hidden) {
        unlockAudio()
        loadKOTs()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadKOTs])

  async function markReady(kotId: string) {
    const supabase = createClient()
    const kot = kots.find(k => k.id === kotId)

    await supabase
      .from('kot_entries')
      .update({ status: 'ready' })
      .eq('id', kotId)

    if (kot) {
      const itemIds = kot.order.items
        .filter(i => i.station === kot.station && !i.is_cancelled)
        .map(i => i.id)

      if (itemIds.length > 0) {
        await supabase
          .from('order_items')
          .update({ kot_status: 'ready' })
          .in('id', itemIds)
      }

      const tableName = kot.order.table
        ? getTableDisplayName(kot.order.table)
        : 'Takeaway'
      if (readyAlertChannelRef.current) {
        readyAlertChannelRef.current.send({
          type: 'broadcast',
          event: 'ready',
          payload: {
            station: 'cafe',
            station_label: 'Cafe Counter',
            table_name: tableName,
            order_number: (kot.order as any).order_number || '',
            kot_number: kot.kot_number,
          },
        })
      }

      // Fire-and-forget push notification to all waiters
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'kot-ready',
          station_label: 'Cafe Counter',
          table_name: tableName,
          order_number: (kot.order as any).order_number || '',
          kot_number: kot.kot_number,
        }),
      }).catch(() => {})
    }

    toast.success('Marked as ready!')
    loadKOTs()
  }

  async function ringCaptain(kot: KOTWithDetails) {
    const tableName = kot.order.table
      ? getTableDisplayName(kot.order.table)
      : 'Takeaway'
    if (ringChannelRef.current) {
      ringChannelRef.current.send({
        type: 'broadcast',
        event: 'ring',
        payload: {
          waiter_id: (kot.order as any).waiter_id,
          waiter_name: kot.order.waiter?.name,
          table_name: tableName,
          kot_number: kot.kot_number,
        },
      })
    }

    // Fire-and-forget push notification to specific waiter
    if ((kot.order as any).waiter_id) {
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ring',
          waiter_id: (kot.order as any).waiter_id,
          table_name: tableName,
          kot_number: kot.kot_number,
        }),
      }).catch(() => {})
    }

    toast.success(`Ringed ${kot.order.waiter?.name || 'captain'}!`)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/cafe/login')
  }

  function dismissPopupKot(kotId: string) {
    setNewOrderPopup(prev => prev.filter(k => k.id !== kotId))
  }

  function dismissAllPopup() {
    setNewOrderPopup([])
  }

  async function markReadyFromPopup(kotId: string) {
    await markReady(kotId)
    dismissPopupKot(kotId)
  }

  function cycleTheme() {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  const ThemeIcon = mounted
    ? theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
    : Monitor

  const themeLabel = mounted
    ? theme === 'dark' ? 'Dark mode' : theme === 'light' ? 'Light mode' : 'Auto (system)'
    : 'Loading...'

  // Split KOTs into pending and ready
  const pendingKots = kots.filter(k => k.status === 'pending')
  const readyKots = kots.filter(k => k.status === 'ready').reverse()

  if (!authenticated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg mb-2">Failed to load orders</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{error}</p>
          <Button onClick={loadKOTs} className="bg-amber-600 hover:bg-amber-700 text-white">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  function renderKOTCard(kot: KOTWithDetails, isReady: boolean) {
    const stationItems = kot.order.items.filter(i => i.station === kot.station && !i.is_cancelled)
    const timeAgo = formatDistanceToNow(new Date(kot.created_at), { addSuffix: false })

    return (
      <Card
        key={kot.id}
        className={`border-2 ${
          isReady
            ? 'border-green-600 bg-green-50 dark:bg-green-950/30'
            : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                {kot.kot_number}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {kot.order.table ? (
                  <Badge className="bg-blue-600 text-white text-base px-3 py-1">
                    {getTableDisplayName(kot.order.table)}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-600 text-white text-base px-3 py-1">Takeaway</Badge>
                )}
                {kot.order.waiter && (
                  <span className="text-base font-semibold text-gray-600 dark:text-gray-300">
                    {kot.order.waiter.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm">{timeAgo}</span>
              </div>
              {isReady && (
                <Badge className="bg-green-600 text-white mt-1">ready</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {stationItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${isReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.quantity}x
                  </span>
                  <span className="text-gray-900 dark:text-white text-base">{item.menu_item?.name}</span>
                </div>
                {item.notes && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 italic">{item.notes}</span>
                )}
              </div>
            ))}
          </div>

          {kot.order.notes && (
            <p className="text-sm text-yellow-700 dark:text-yellow-400 italic mb-3 bg-yellow-50 dark:bg-yellow-950/50 p-2 rounded">
              Note: {kot.order.notes}
            </p>
          )}

          <div className="flex gap-2">
            {!isReady && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-5 text-lg font-bold"
                onClick={() => markReady(kot.id)}
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Ready
              </Button>
            )}
            {kot.order.waiter && (
              <Button
                className={`bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 ${isReady ? 'flex-1 text-base' : ''}`}
                onClick={() => ringCaptain(kot)}
                title={`Ring ${kot.order.waiter.name}`}
              >
                <Bell className="h-5 w-5 mr-2" />
                {isReady ? `Ring ${kot.order.waiter.name}` : ''}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* New Order Popup Overlay */}
      {newOrderPopup.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Popup header */}
            <div className="bg-amber-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 animate-bounce" />
                <h2 className="text-xl font-bold">
                  {newOrderPopup.length} New Order{newOrderPopup.length > 1 ? 's' : ''}!
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissAllPopup}
                className="text-white hover:bg-amber-600 text-sm"
              >
                Dismiss All
              </Button>
            </div>

            {/* Orders list */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {newOrderPopup.map(kot => {
                const stationItems = kot.order.items.filter(i => i.station === kot.station && !i.is_cancelled)
                const tableName = kot.order.table
                  ? getTableDisplayName(kot.order.table)
                  : 'Takeaway'

                return (
                  <div key={kot.id} className="p-5">
                    {/* KOT info */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{kot.kot_number}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-blue-600 text-white text-base px-3 py-1">{tableName}</Badge>
                          {kot.order.waiter && (
                            <span className="text-base font-semibold text-gray-600 dark:text-gray-300">{kot.order.waiter.name}</span>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-base px-3 py-1">
                        NEW
                      </Badge>
                    </div>

                    {/* Items */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4 space-y-2">
                      {stationItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{item.quantity}x</span>
                            <span className="text-base text-gray-900 dark:text-white font-medium">{item.menu_item?.name}</span>
                          </div>
                          {item.notes && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 italic">{item.notes}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {kot.order.notes && (
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 italic mb-3 bg-yellow-50 dark:bg-yellow-950/50 p-2 rounded">
                        Note: {kot.order.notes}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-6 text-xl font-bold rounded-xl"
                        onClick={() => markReadyFromPopup(kot.id)}
                      >
                        <CheckCircle2 className="h-6 w-6 mr-2" />
                        Mark Ready
                      </Button>
                      <Button
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6 text-xl font-bold rounded-xl"
                        onClick={() => dismissPopupKot(kot.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Coffee className="h-6 w-6 text-amber-700 dark:text-amber-400" />
          <h1 className="font-bold text-lg">Cafe Display</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-700 text-white">{pendingKots.length} pending</Badge>
          {readyKots.length > 0 && (
            <Badge className="bg-green-600 text-white">{readyKots.length} ready</Badge>
          )}
          {notifPermission === 'denied' && (
            <span className="text-xs text-red-500 dark:text-red-400" title="Browser notifications are blocked. Enable in browser settings.">
              Notifications off
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="text-gray-600 dark:text-gray-300"
            title={themeLabel}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSoundEnabled(prev => {
                const next = !prev
                localStorage.setItem('cafe-sound', next ? '1' : '0')
                if (next) unlockAudio()
                return next
              })
            }}
            className="text-gray-600 dark:text-gray-300"
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={loadKOTs} className="text-gray-600 dark:text-gray-300">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400" title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* KOT Sections */}
      <main className="p-4 space-y-6">
        {/* Empty state */}
        {pendingKots.length === 0 && readyKots.length === 0 && (
          <div className="text-center py-24 text-gray-400 dark:text-gray-500">
            <Coffee className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">No pending orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        )}

        {/* Pending Section */}
        {pendingKots.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Pending ({pendingKots.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingKots.map(kot => renderKOTCard(kot, false))}
            </div>
          </section>
        )}

        {/* Ready Section */}
        {readyKots.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">
              Ready ({readyKots.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyKots.map(kot => renderKOTCard(kot, true))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
