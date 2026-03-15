'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Setting, PrintStation } from '@/types/database'
import { STATIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Printer, Lock, PlayCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { testPrinter } from '@/lib/utils/print'

export default function SettingsPage() {
  const { profile } = useAuth(['admin'])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [printers, setPrinters] = useState<PrintStation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null)
  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [settingsResult, printersResult] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('print_stations').select('*').order('station_type'),
    ])

    if (settingsResult.data) {
      const map: Record<string, string> = {}
      settingsResult.data.forEach((s: Setting) => { map[s.key] = s.value })
      setSettings(map)
    }
    if (printersResult.data) setPrinters(printersResult.data as PrintStation[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function saveSettings() {
    setSaving(true)
    const supabase = createClient()

    const updates = Object.entries(settings).map(([key, value]) =>
      supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
    )

    await Promise.all(updates)
    toast.success('Settings saved')
    setSaving(false)
  }

  async function updatePrinter(printer: PrintStation, field: string, value: string | boolean | number) {
    const supabase = createClient()
    await supabase
      .from('print_stations')
      .update({ [field]: value })
      .eq('id', printer.id)

    setPrinters(prev =>
      prev.map(p => p.id === printer.id ? { ...p, [field]: value } : p)
    )
  }

  const getStationLabel = (type: string) => {
    if (type === 'billing') return 'Cashier (Billing)'
    return STATIONS.find(s => s.value === type)?.label || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Cafe Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cafe Details</CardTitle>
          <CardDescription>Your cafe information shown on bills and receipts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cafe Name</Label>
            <Input
              value={settings.cafe_name || ''}
              onChange={(e) => setSettings({ ...settings, cafe_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={settings.cafe_address || ''}
              onChange={(e) => setSettings({ ...settings, cafe_address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={settings.cafe_phone || ''}
                onChange={(e) => setSettings({ ...settings, cafe_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input
                value={settings.gst_number || ''}
                onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>FSSAI License No.</Label>
              <Input
                value={settings.fssai_number || ''}
                onChange={(e) => setSettings({ ...settings, fssai_number: e.target.value })}
                placeholder="e.g. 13621011002089"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GST Percentage</Label>
              <Input
                type="number"
                value={settings.gst_percent || '5'}
                onChange={(e) => setSettings({ ...settings, gst_percent: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Service Charge %</Label>
              <Input
                type="number"
                value={settings.service_charge_percent || '10'}
                onChange={(e) => setSettings({ ...settings, service_charge_percent: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Security PIN */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security PIN
          </CardTitle>
          <CardDescription>
            PIN required for item cancellation, service charge removal, NC, and bill reprints. Must be set for cashier operations to work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Security PIN</Label>
              <Input
                type="password"
                placeholder="Set a PIN (e.g., 1234)"
                value={settings.security_pin || ''}
                onChange={(e) => setSettings({ ...settings, security_pin: e.target.value })}
              />
            </div>
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Day Boundary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Business Day Boundary
          </CardTitle>
          <CardDescription>
            When does a new business day start? Orders placed between midnight and this hour count as the previous day.
            Useful for late-night service on weekends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>New Day Starts At</Label>
              <Select
                value={settings.day_boundary_hour || '3'}
                onValueChange={(v) => v != null && setSettings({ ...settings, day_boundary_hour: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">12:00 AM (Midnight)</SelectItem>
                  <SelectItem value="1">1:00 AM</SelectItem>
                  <SelectItem value="2">2:00 AM</SelectItem>
                  <SelectItem value="3">3:00 AM (Recommended)</SelectItem>
                  <SelectItem value="4">4:00 AM</SelectItem>
                  <SelectItem value="5">5:00 AM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Example: If set to 3 AM, a bill at 1 AM on Saturday will appear under Friday&apos;s sales.
          </p>
        </CardContent>
      </Card>

      {/* Printer Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Printer Stations
          </CardTitle>
          <CardDescription>
            Configure the IP addresses of your Epson thermal printers on the LAN.
            All printers should be connected to the same ethernet network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {printers.map((printer, index) => (
            <div key={printer.id}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">{printer.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{getStationLabel(printer.station_type)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!printer.is_active || !printer.printer_ip || testingPrinter === printer.id}
                    onClick={async () => {
                      setTestingPrinter(printer.id)
                      try {
                        const ok = await testPrinter(printer.printer_ip, printer.port)
                        if (ok) {
                          toast.success(`Test sent to ${printer.name}`)
                        } else {
                          toast.error(`Failed to send test to ${printer.name}`)
                        }
                      } catch {
                        toast.error(`Error testing ${printer.name}`)
                      } finally {
                        setTestingPrinter(null)
                      }
                    }}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    {testingPrinter === printer.id ? 'Sending...' : 'Test'}
                  </Button>
                  <Switch
                    checked={printer.is_active}
                    onCheckedChange={(v) => updatePrinter(printer, 'is_active', v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">IP Address</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={printer.printer_ip}
                    onChange={(e) => updatePrinter(printer, 'printer_ip', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    type="number"
                    value={printer.port}
                    onChange={(e) => updatePrinter(printer, 'port', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  )
}
