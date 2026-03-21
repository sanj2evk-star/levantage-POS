'use client'

import { useEffect, useRef } from 'react'
import { Profile } from '@/types/database'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribes the current device to Web Push notifications.
 * Call once per session from the waiter page after auth.
 * - Requests notification permission
 * - Always creates a fresh push subscription (handles SW updates)
 * - Sends subscription to /api/push/subscribe
 * - Retries once on failure after 5 seconds
 */
export function usePushSubscription(profile: Profile | null) {
  const didRun = useRef(false)

  useEffect(() => {
    if (!profile?.id) return
    if (didRun.current) return
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[PUSH] No VAPID public key configured')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PUSH] Push notifications not supported')
      return
    }

    didRun.current = true

    async function subscribe(attempt = 1) {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          console.log('[PUSH] Notification permission denied')
          return
        }

        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready

        // Unsubscribe any existing subscription first — ensures fresh
        // subscription tied to the current service worker version.
        // Stale subscriptions (from old SW) silently fail to deliver.
        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          await existing.unsubscribe()
          console.log('[PUSH] Cleared old subscription')
        }

        // Create a fresh subscription
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        })

        // Send subscription to our API
        const subJson = subscription.toJSON()
        const resp = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        })

        if (!resp.ok) {
          throw new Error(`Subscribe API returned ${resp.status}`)
        }

        console.log('[PUSH] Subscribed successfully')
      } catch (err) {
        console.error(`[PUSH] Subscription failed (attempt ${attempt}):`, err)
        // Retry once after 5 seconds
        if (attempt < 2) {
          setTimeout(() => subscribe(attempt + 1), 5000)
        }
      }
    }

    subscribe()
  }, [profile?.id])
}
