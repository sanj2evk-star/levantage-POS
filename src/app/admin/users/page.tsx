'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'manager', label: 'Manager', description: 'Menu, tables, and reports' },
  { value: 'accountant', label: 'Accountant', description: 'View reports and billing data' },
  { value: 'cashier', label: 'Cashier', description: 'POS, billing, and basic reports' },
  { value: 'waiter', label: 'Waiter', description: 'Order taking on mobile' },
]

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // New user dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'waiter' as UserRole,
    phone: '',
    pin: '',
  })

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'waiter' as UserRole,
    phone: '',
    pin: '',
  })

  const loadProfiles = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setProfiles(data as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  async function createUser() {
    if (!form.email || !form.password || !form.name) {
      toast.error('Email, password, and name are required')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    const supabase = createClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name },
      },
    })

    if (authError) {
      toast.error(authError.message)
      return
    }

    if (authData.user) {
      // Update profile with role and details
      await supabase
        .from('profiles')
        .update({
          name: form.name,
          role: form.role,
          phone: form.phone || null,
          pin: form.pin || null,
        })
        .eq('id', authData.user.id)
    }

    toast.success(`Staff member "${form.name}" created`)
    setDialogOpen(false)
    setForm({ email: '', password: '', name: '', role: 'waiter', phone: '', pin: '' })
    loadProfiles()
  }

  function openEdit(profile: Profile) {
    setEditingProfile(profile)
    setEditForm({
      name: profile.name,
      role: profile.role,
      phone: profile.phone || '',
      pin: profile.pin || '',
    })
    setEditDialogOpen(true)
  }

  async function updateProfile() {
    if (!editingProfile) return
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        name: editForm.name,
        role: editForm.role,
        phone: editForm.phone || null,
        pin: editForm.pin || null,
      })
      .eq('id', editingProfile.id)

    if (error) {
      toast.error('Failed to update profile')
      return
    }

    toast.success('Profile updated')
    setEditDialogOpen(false)
    loadProfiles()
  }

  async function toggleActive(profile: Profile) {
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id)
    loadProfiles()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'manager': return 'bg-indigo-100 text-indigo-800'
      case 'accountant': return 'bg-teal-100 text-teal-800'
      case 'cashier': return 'bg-blue-100 text-blue-800'
      case 'waiter': return 'bg-green-100 text-green-800'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No staff members yet
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id} className={!profile.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(profile.role)} variant="secondary">
                        {profile.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{profile.phone || '-'}</TableCell>
                    <TableCell>{profile.pin ? '****' : '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={profile.is_active}
                        onCheckedChange={() => toggleActive(profile)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Create a new account for a staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g., Rahul Kumar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="staff@levantage.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => v != null && setForm({ ...form, role: v as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <span className="font-medium">{role.label}</span>
                        <span className="text-gray-500 ml-2 text-xs">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="Optional"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>4-digit PIN</Label>
                <Input
                  placeholder="For quick login"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={createUser}>Create Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => v != null && setEditForm({ ...editForm, role: v as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>4-digit PIN</Label>
                <Input
                  maxLength={4}
                  value={editForm.pin}
                  onChange={(e) => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={updateProfile}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
