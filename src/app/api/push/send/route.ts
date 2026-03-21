import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@levantage.cafe',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface SendRequest {
  type: 'kot-ready' | 'ring'
  waiter_id?: string
  station_label?: string
  table_name?: string
  order_number?: string
  kot_number?: string
}

// POST — send push notification to waiters
export async function POST(request: NextRequest) {
  try {
    const body: SendRequest = await request.json()
    const { type, waiter_id, station_label, table_name, order_number, kot_number } = body

    // Use admin client to bypass RLS and read all subscriptions
    const supabase = createAdminClient()

    let query = supabase.from('push_subscriptions').select('*')

    if (type === 'ring' && waiter_id) {
      // Ring: send only to the specific waiter
      query = query.eq('user_id', waiter_id)
    }
    // kot-ready: send to ALL waiter subscriptions (no filter)

    const { data: subscriptions, error } = await query

    if (error) {
      console.error('[PUSH] Fetch subscriptions error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    // Build notification payload
    let title: string
    let notifBody: string

    if (type === 'ring') {
      title = '🔔 Captain needed!'
      notifBody = `${table_name || 'Table'} — KOT ${kot_number || ''} is ready for pickup`
    } else {
      title = '✅ Order Ready'
      notifBody = `${station_label || 'Station'}: ${table_name || 'Table'} — ${kot_number || ''}`
    }

    const payload = JSON.stringify({
      title,
      body: notifBody,
      type,
      url: '/waiter',
    })

    // Send to all matching subscriptions, clean up stale ones
    const staleIds: string[] = []
    let sentCount = 0

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            {
              TTL: 14400,        // 4 hours — survives Android Doze mode
              urgency: 'high',   // tells FCM to wake the device immediately
            }
          )
          sentCount++
        } catch (err: any) {
          // 410 Gone or 404 — subscription expired, clean up
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(sub.id)
          } else {
            console.error(`[PUSH] Send failed for ${sub.endpoint}:`, err.statusCode, err.body)
          }
        }
      })
    )

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', staleIds)
      console.log(`[PUSH] Cleaned ${staleIds.length} stale subscriptions`)
    }

    return NextResponse.json({ sent: sentCount, cleaned: staleIds.length })
  } catch (err) {
    console.error('[PUSH] Send error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
