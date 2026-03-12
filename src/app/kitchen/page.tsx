'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { KOTEntry, OrderItem, Order, StationType } from '@/types/database'
import { STATIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChefHat,
  Clock,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Volume2,
  VolumeX,
  Printer,
} from 'lucide-react'
import { reprintKOT } from '@/lib/utils/print'
import { usePrintStatus } from '@/hooks/use-print-status'
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

const ALL_STATIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STATIONS,
]

export default function KitchenPage() {
  const { profile, isLoading, signOut } = useAuth()
  const printStatus = usePrintStatus()
  const [kots, setKots] = useState<KOTWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStation, setActiveStation] = useState<string>('all')
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kitchen-sound') !== '0'
    }
    return true
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const prevCountRef = useRef(0)

  // Request notification permission for background-tab alerts
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotifPermission(perm)
        })
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

    let query = supabase
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
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true })

    if (activeStation !== 'all') {
      query = query.eq('station', activeStation)
    }

    const { data } = await query

    if (data) {
      const newKots = data as unknown as KOTWithDetails[]
      // Play sound and notify if new KOTs arrived
      if (newKots.length > prevCountRef.current && prevCountRef.current > 0) {
        const newCount = newKots.length - prevCountRef.current
        if (soundEnabled) {
          playNewOrderSound()
        }
        toast.info(`${newCount} new KOT${newCount > 1 ? 's' : ''} received!`, { duration: 4000 })
        // Show browser notification when tab is in background
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New KOT!', {
            body: `${newCount} new order${newCount > 1 ? 's' : ''} received`,
            icon: '/icons/icon-192.png',
            tag: 'new-kot',
          } as NotificationOptions)
        }
      }
      prevCountRef.current = newKots.length
      setKots(newKots)
    }
    setLoading(false)
  }, [activeStation, soundEnabled])

  useEffect(() => {
    loadKOTs()

    // Set up realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('kitchen-orders')
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

  async function updateKOTStatus(kotId: string, newStatus: 'preparing' | 'ready') {
    const supabase = createClient()
    await supabase
      .from('kot_entries')
      .update({ status: newStatus })
      .eq('id', kotId)

    // If ready, also update order items
    const kot = kots.find(k => k.id === kotId)
    if (kot && newStatus === 'ready') {
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

    toast.success(newStatus === 'preparing' ? 'Started preparing' : 'Marked as ready!')
    loadKOTs()
  }

  // getSectionLabel removed — using getTableDisplayName from table-display utility

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-amber-500" />
          <h1 className="font-bold text-lg">Kitchen Display</h1>
          <span
            className={`h-2 w-2 rounded-full ${
              printStatus ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={printStatus ? 'Print proxy connected' : 'Print proxy offline'}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-600">{kots.length} pending</Badge>
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
                localStorage.setItem('kitchen-sound', next ? '1' : '0')
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
          <Button variant="ghost" size="icon" onClick={signOut} className="text-gray-300">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Station Filter Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex gap-2 overflow-x-auto">
        {ALL_STATIONS.map(station => (
          <button
            key={station.value}
            onClick={() => setActiveStation(station.value)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeStation === station.value
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {station.label}
          </button>
        ))}
      </div>

      {/* KOT Grid */}
      <main className="p-4">
        {kots.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">No pending orders</p>
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kots.map(kot => {
              const stationItems = kot.order.items.filter(i => i.station === kot.station && !i.is_cancelled)
              const timeAgo = formatDistanceToNow(new Date(kot.created_at), { addSuffix: false })
              const stationLabel = STATIONS.find(s => s.value === kot.station)?.label || kot.station

              return (
                <Card
                  key={kot.id}
                  className={`border-2 ${
                    kot.status === 'preparing'
                      ? 'border-yellow-500 bg-yellow-950/30'
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
                          {activeStation === 'all' && (
                            <Badge className="bg-gray-600 text-xs">{stationLabel}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-sm">{timeAgo}</span>
                        </div>
                        <Badge className={
                          kot.status === 'preparing' ? 'bg-yellow-600 mt-1' : 'bg-gray-600 mt-1'
                        }>
                          {kot.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {stationItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-amber-400">
                              {item.quantity}x
                            </span>
                            <span className="text-white">{item.menu_item?.name}</span>
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
                      {kot.status === 'pending' && (
                        <Button
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                          onClick={() => updateKOTStatus(kot.id, 'preparing')}
                        >
                          Start Preparing
                        </Button>
                      )}
                      {kot.status === 'preparing' && (
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => updateKOTStatus(kot.id, 'ready')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Ready
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-400 hover:text-white border-gray-600"
                        onClick={async () => {
                          const success = await reprintKOT(
                            kot.station as StationType,
                            kot.kot_number,
                            kot.order?.order_number || '',
                            kot.order?.table?.number || null,
                            kot.order?.table?.section || null,
                            (kot.order?.order_type || 'dine_in') as 'dine_in' | 'takeaway',
                            stationItems.map(i => ({
                              name: i.menu_item?.name || 'Unknown',
                              quantity: i.quantity,
                              notes: i.notes || undefined,
                            })),
                            kot.order?.notes || undefined
                          )
                          if (success) {
                            toast.success('KOT reprint sent')
                          } else {
                            toast.error('Reprint failed - check printer')
                          }
                          // Log to audit
                          const supabase = createClient()
                          const { data: { user } } = await supabase.auth.getUser()
                          await supabase.from('audit_logs').insert({
                            action: 'kot_reprint',
                            order_id: kot.order_id,
                            performed_by: user?.id || null,
                            details: {
                              kot_number: kot.kot_number,
                              station: kot.station,
                              order_number: kot.order?.order_number,
                            },
                          })
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
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
