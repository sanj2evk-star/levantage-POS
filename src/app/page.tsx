import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  switch (profile?.role) {
    case 'admin':
    case 'manager':
      redirect('/admin')
      break
    case 'accountant':
      redirect('/admin/reports')
      break
    case 'cashier':
      redirect('/cashier')
      break
    case 'waiter':
      redirect('/waiter')
      break
    default:
      redirect('/pos')
  }
}
