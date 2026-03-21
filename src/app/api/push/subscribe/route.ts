import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — upsert a push subscription for the logged-in user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint, keys } = await request.json()

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Upsert — update keys if endpoint already exists for this user
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )

    if (error) {
      console.error('[PUSH] Subscribe error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUSH] Subscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — remove push subscription on sign-out
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = await request.json()

    if (endpoint) {
      // Remove specific subscription
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
    } else {
      // Remove all subscriptions for this user
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUSH] Unsubscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
