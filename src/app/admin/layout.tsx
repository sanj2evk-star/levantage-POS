'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'
import { UserRole } from '@/types/database'
import {
  Coffee,
  UtensilsCrossed,
  Grid3X3,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Database,
  Eye,
  CalendarCheck,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

// Which roles can see each nav item
const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/admin/running', label: 'Running Orders', icon: Clock, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/admin/tables', label: 'Tables', icon: Grid3X3, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager', 'accountant'] as UserRole[] },
  { href: '/admin/eod', label: 'EOD', icon: CalendarCheck, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/admin/data', label: 'Data', icon: Database, roles: ['admin'] as UserRole[] },
  { href: '/admin/hawkeye', label: 'Hawk Eye', icon: Eye, roles: ['admin'] as UserRole[] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] as UserRole[] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] as UserRole[] },
]

// Roles that can access the admin panel at all
const ADMIN_PANEL_ROLES: UserRole[] = ['admin', 'manager', 'accountant']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, signOut } = useAuth(ADMIN_PANEL_ROLES)
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
      </div>
    )
  }

  if (!profile || !ADMIN_PANEL_ROLES.includes(profile.role as UserRole)) {
    return null
  }

  const visibleNav = navItems.filter(item => item.roles.includes(profile.role as UserRole))

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <Coffee className="h-6 w-6 text-amber-700" />
              <span className="font-semibold text-lg">{APP_NAME}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {visibleNav.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amber-50 text-amber-900'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive ? 'text-amber-700' : '')} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                {profile.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600 hover:text-red-600"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Link href="/pos">
            <Button variant="outline" size="sm">
              Open POS
            </Button>
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
