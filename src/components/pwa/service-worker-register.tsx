'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates every 60 minutes
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000)
        })
        .catch((err) => {
          console.error('[SW] Registration failed:', err)
        })
    }
  }, [])

  return null
}
