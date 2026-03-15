'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS() {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

function wasDismissedRecently() {
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  if (!dismissed) return false
  // Allow re-prompt after 7 days
  const dismissedAt = parseInt(dismissed, 10)
  if (isNaN(dismissedAt)) return false
  return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Already installed
    if (isInStandaloneMode()) return
    // Dismissed recently
    if (wasDismissedRecently()) return

    if (isIOS()) {
      // iOS doesn't have beforeinstallprompt — show custom instructions
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setShowIOSInstructions(true), 2000)
      return () => clearTimeout(timer)
    }

    // Android / Chrome — listen for the native prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShowBanner(false)
    setShowIOSInstructions(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Android / Chrome install banner
  if (showBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Download className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Install Le Vantage</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add to home screen for quick access</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-600 hover:bg-amber-700"
            onClick={handleInstall}
          >
            Install
          </Button>
          <button onClick={handleDismiss} className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // iOS instructions banner
  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Download className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Install Le Vantage</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Tap <Share className="inline h-3.5 w-3.5 -mt-0.5 text-blue-500" /> <span className="font-medium">Share</span> then <span className="font-medium">&quot;Add to Home Screen&quot;</span>
            </p>
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
