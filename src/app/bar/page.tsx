'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { playNewOrderSound, unlockAudio } from '@/lib/utils/notification-sound'
import { getTableDisplayName } from '@/lib/utils/table-display'

interface KOTWithDetails extends KOTEntry {
  order: Order & {
    table: { number: number; section: string } | null
    items: (OrderItem & {
      menu_item: { name: string; station: string }
    })[]
  }
}

export default function BarPage() {
  const [kots, setKots] = useState<KOTWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bar-sound') !== '0'
    }
    return true
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const prevCountRef = useRef(0)

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

  const loadKOTs = useCallback(async () => {
    const supabase = createClient()

    const { data } = await supabase
      .from('kot_entries')
      .select(`
        id, order_id, station, kot_number, status, created_at,
        order:orders!order_id(
          id, order_number, order_type, notes,
          table:tables!table_id(number, section),
          items:order_items(
            id, quantity, notes, station, is_cancelled,
            menu_item:menu_items(name, station)
          )
        )
      `)
      .eq('station', 'mocktail')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (data) {
      const newKots = data as unknown as KOTWithDetails[]
      // Play sound and notify if new KOTs arrived
      if (newKots.length > prevCountRef.current && prevCountRef.current > 0) {
        const newCount = newKots.length - prevCountRef.current
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
      prevCountRef.current = newKots.length
      setKots(newKots)
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
    await supabase
      .from('kot_entries')
      .update({ status: 'ready' })
      .eq('id', kotId)

    // Also update order items
    const kot = kots.find(k => k.id === kotId)
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
    }

    toast.success('Marked as ready!')
    loadKOTs()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
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
          <Badge className="bg-purple-600">{kots.length} pending</Badge>
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
        </div>
      </header>

      {/* KOT Grid */}
      <main className="p-4">
        {kots.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Wine className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">No pending orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kots.map(kot => {
              const stationItems = kot.order.items.filter(i => i.station === kot.station && !i.is_cancelled)
              const timeAgo = formatDistanceToNow(new Date(kot.created_at), { addSuffix: false })

              return (
                <Card
                  key={kot.id}
                  className="border-2 border-gray-600 bg-gray-800"
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
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-sm">{timeAgo}</span>
                        </div>
                        <Badge className="bg-gray-600 mt-1">
                          {kot.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {stationItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-purple-400">
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

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 py-3 text-base"
                      onClick={() => markReady(kot.id)}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Ready
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
