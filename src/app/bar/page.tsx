'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KOTEntry, OrderItem, Order } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Wine,
  Clock,
  CheckCircle2,
  RefreshCw,
  Volume2,
  VolumeX,
  Bell,
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { playNewOrderSound, unlockAudio } from '@/lib/utils/notification-sound'
import { getTableDisplayName } from '@/lib/utils/table-display'
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

export default function BarPage() {
  const [kots, setKots] = useState<KOTWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bar-sound') !== '0'
    }
    return true
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const prevPendingCountRef = useRef(0)
  const ringChannelRef = useRef<RealtimeChannel | null>(null)
  const readyAlertChannelRef = useRef<RealtimeChannel | null>(null)
  const router = useRouter()

  // Check auth session - redirect to bar login if not authenticated
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/bar/login')
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

  // Unlock Web Audio API on first user interaction
  useEffect(() => {
    function unlock() {
      unlockAudio()
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
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
      .eq('station', 'mocktail')
      .in('status', ['pending', 'ready'])
      .order('created_at', { ascending: true })

    if (queryError) {
      console.error('Bar KOT query error:', queryError)
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
        // Sort KOTs by created_at ascending
        const sorted = [...group].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const allItems = sorted[0].order.items.filter(
          (i: any) => i.station === sorted[0].station && !i.is_cancelled
        )
        allItems.sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        // Assign each item to the KOT created closest before it
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

      // Play sound and notify if new pending KOTs arrived
      if (pendingCount > prevPendingCountRef.current && prevPendingCountRef.current > 0) {
        const newCount = pendingCount - prevPendingCountRef.current
        if (soundEnabled) {
          playNewOrderSound()
        }
        toast.info(`${newCount} new order${newCount > 1 ? 's' : ''} received!`, { duration: 4000 })
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New Bar Order!', {
            body: `${newCount} new order${newCount > 1 ? 's' : ''} received`,
            icon: '/icons/icon-192.png',
            tag: 'new-bar-kot',
          } as NotificationOptions)
        }
      }
      prevPendingCountRef.current = pendingCount
      setKots(allKots)
    }
    setLoading(false)
  }, [soundEnabled])

  useEffect(() => {
    loadKOTs()

    const supabase = createClient()
    const channel = supabase
      .channel('bar-orders')
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadKOTs])

  async function markReady(kotId: string) {
    const supabase = createClient()
    const kot = kots.find(k => k.id === kotId)

    await supabase
      .from('kot_entries')
      .update({ status: 'ready' })
      .eq('id', kotId)

    // Also update order items
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

      // Send broadcast alert to waiter apps
      const tableName = kot.order.table
        ? getTableDisplayName(kot.order.table)
        : 'Takeaway'
      if (readyAlertChannelRef.current) {
        readyAlertChannelRef.current.send({
          type: 'broadcast',
          event: 'ready',
          payload: {
            station: 'mocktail',
            station_label: 'Bar Counter',
            table_name: tableName,
            order_number: (kot.order as any).order_number || '',
            kot_number: kot.kot_number,
          },
        })
      }
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
    toast.success(`Ringed ${kot.order.waiter?.name || 'captain'}!`)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/bar/login')
  }

  // Split KOTs into pending and ready
  const pendingKots = kots.filter(k => k.status === 'pending')
  const readyKots = kots.filter(k => k.status === 'ready')

  if (!authenticated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Failed to load orders</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <Button onClick={loadKOTs} className="bg-purple-600 hover:bg-purple-700">
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
            ? 'border-green-600 bg-green-950/30'
            : 'border-gray-600 bg-gray-800'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-white">
                {kot.kot_number}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {kot.order.table ? (
                  <Badge className="bg-blue-600">
                    {getTableDisplayName(kot.order.table)}
                  </Badge>
                ) : (
                  <Badge className="bg-purple-600">Takeaway</Badge>
                )}
                {kot.order.waiter && (
                  <span className="text-xs text-gray-400">
                    {kot.order.waiter.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm">{timeAgo}</span>
              </div>
              {isReady && (
                <Badge className="bg-green-600 mt-1">ready</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {stationItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${isReady ? 'text-green-400' : 'text-purple-400'}`}>
                    {item.quantity}x
                  </span>
                  <span className="text-white text-base">{item.menu_item?.name}</span>
                </div>
                {item.notes && (
                  <span className="text-xs text-yellow-400 italic">{item.notes}</span>
                )}
              </div>
            ))}
          </div>

          {kot.order.notes && (
            <p className="text-sm text-yellow-400 italic mb-3 bg-yellow-950/50 p-2 rounded">
              Note: {kot.order.notes}
            </p>
          )}

          <div className="flex gap-2">
            {!isReady && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 text-base"
                onClick={() => markReady(kot.id)}
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Ready
              </Button>
            )}
            {kot.order.waiter && (
              <Button
                className={`bg-orange-600 hover:bg-orange-700 py-3 px-4 ${isReady ? 'flex-1 text-base' : ''}`}
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Wine className="h-6 w-6 text-purple-400" />
          <h1 className="font-bold text-lg">Bar Display</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-600">{pendingKots.length} pending</Badge>
          {readyKots.length > 0 && (
            <Badge className="bg-green-600">{readyKots.length} ready</Badge>
          )}
          {notifPermission === 'denied' && (
            <span className="text-xs text-red-400" title="Browser notifications are blocked. Enable in browser settings.">
              Notifications off
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSoundEnabled(prev => {
                const next = !prev
                localStorage.setItem('bar-sound', next ? '1' : '0')
                if (next) unlockAudio()
                return next
              })
            }}
            className="text-gray-300"
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={loadKOTs} className="text-gray-300">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-gray-400 hover:text-red-400" title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* KOT Sections */}
      <main className="p-4 space-y-6">
        {/* Empty state */}
        {pendingKots.length === 0 && readyKots.length === 0 && (
          <div className="text-center py-24 text-gray-500">
            <Wine className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">No pending orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        )}

        {/* Pending Section */}
        {pendingKots.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
            <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">
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
