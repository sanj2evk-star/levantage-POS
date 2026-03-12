'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { Profile, UserRole } from '@/types/database'

export function useAuth(requiredRole?: UserRole | UserRole[]) {
  const router = useRouter()
  const { profile, isLoading, setProfile, setLoading } = useAuthStore()

  // Stabilize requiredRole to prevent infinite re-renders when an array literal is passed
  const roleKey = Array.isArray(requiredRole) ? requiredRole.join(',') : (requiredRole || '')
  const stableRole = useMemo(
    () => requiredRole,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleKey]
  )

  useEffect(() => {
    const supabase = createClient()

    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setProfile(null)
          setLoading(false)
          router.push('/login')
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('[AUTH] Profile fetch error:', profileError.message)
        }

        if (profileData) {
          setProfile(profileData as Profile)

          // Check role if required
          if (stableRole) {
            const roles = Array.isArray(stableRole) ? stableRole : [stableRole]
            if (!roles.includes(profileData.role as UserRole)) {
              router.push('/pos')
            }
          }
        }
      } catch (err) {
        console.error('[AUTH] Error:', err)
        setProfile(null)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setProfile(null)
          router.push('/login')
        } else if (event === 'SIGNED_IN') {
          getProfile()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, setProfile, setLoading, stableRole])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setProfile(null)
    router.push('/login')
  }

  return { profile, isLoading, signOut }
}
