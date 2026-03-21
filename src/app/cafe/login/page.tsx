'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Coffee, Loader2 } from 'lucide-react'

export default function CafeLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  // Auto-redirect if already logged in
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/cafe')
      } else {
        setCheckingSession(false)
      }
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Always redirect to cafe display regardless of role
      router.replace('/cafe')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-950 to-stone-900">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-950 to-stone-900 p-4">
      <Card className="w-full max-w-md border-amber-800/40 bg-stone-900/80 text-white">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-900/50 ring-2 ring-amber-500/30">
            <Coffee className="h-8 w-8 text-amber-400" />
          </div>
          <CardTitle className="text-2xl text-white">Cafe Display</CardTitle>
          <CardDescription className="text-amber-300/70">
            Sign in to access the cafe order display
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-amber-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="cafe@levantage.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-amber-700/40 bg-stone-800/60 text-white placeholder:text-stone-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-amber-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-amber-700/40 bg-stone-800/60 text-white placeholder:text-stone-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-amber-700 hover:bg-amber-800 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Open Cafe Display'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
