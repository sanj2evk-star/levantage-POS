'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function BarError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Bar display error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Bar Display Error</h2>
        <p className="text-gray-400 mb-6 text-sm">
          {error.message || 'Failed to load bar display.'}
        </p>
        <Button onClick={reset} className="bg-purple-600 hover:bg-purple-700">
          Reload Bar Display
        </Button>
      </div>
    </div>
  )
}
