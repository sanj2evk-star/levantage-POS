'use client'

import { useState, useEffect } from 'react'
import { checkPrintServer } from '@/lib/utils/print'

export function usePrintStatus(intervalMs = 30000) {
  const [isConnected, setIsConnected] = useState<boolean>(true) // optimistic default

  useEffect(() => {
    let mounted = true

    async function check() {
      const ok = await checkPrintServer()
      if (mounted) setIsConnected(ok)
    }

    check()
    const interval = setInterval(check, intervalMs)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [intervalMs])

  return isConnected
}
