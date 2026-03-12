import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Verify the caller is an admin
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

// POST — Create a new staff user (no email confirmation)
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, password, name, role, phone, pin } = await request.json()

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create auth user — no confirmation email sent with admin API
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm, no email sent
    user_metadata: { name },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Update profile with role and details
  if (authData.user) {
    await admin
      .from('profiles')
      .update({
        name,
        role: role || 'waiter',
        phone: phone || null,
        pin: pin || null,
      })
      .eq('id', authData.user.id)
  }

  return NextResponse.json({ success: true, userId: authData.user.id })
}

// PATCH — Update user (profile + optional password change)
export async function PATCH(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, name, role, phone, pin, password } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Update password if provided
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  // Update profile
  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (role !== undefined) updateData.role = role
  if (phone !== undefined) updateData.phone = phone || null
  if (pin !== undefined) updateData.pin = pin || null

  if (Object.keys(updateData).length > 0) {
    const { error } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE — Delete a staff user
export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Delete profile first (cascade might handle this, but be explicit)
  await admin.from('profiles').delete().eq('id', userId)

  // Delete auth user
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
