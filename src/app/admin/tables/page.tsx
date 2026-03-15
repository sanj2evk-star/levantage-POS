'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table as TableType, TableSection } from '@/types/database'
import { TABLE_SECTIONS, TABLE_STATUS_COLORS } from '@/lib/constants'
import { getTableDisplayName } from '@/lib/utils/table-display'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function TableManagement() {
  const [tables, setTables] = useState<TableType[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<TableType | null>(null)
  const [form, setForm] = useState({
    number: '',
    section: 'ground_floor' as TableSection,
    capacity: '4',
  })

  // Bulk add state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    from: '',
    to: '',
    section: 'ground_floor' as TableSection,
    capacity: '4',
  })

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadTables = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('section')
      .order('number')

    if (data) setTables(data as TableType[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  function openNewTable() {
    setEditingTable(null)
    setForm({ number: '', section: 'ground_floor', capacity: '4' })
    setDialogOpen(true)
  }

  function openEditTable(table: TableType) {
    setEditingTable(table)
    setForm({
      number: table.number.toString(),
      section: table.section,
      capacity: table.capacity.toString(),
    })
    setDialogOpen(true)
  }

  async function saveTable() {
    if (!form.number) {
      toast.error('Table number is required')
      return
    }
    const supabase = createClient()
    const data = {
      number: parseInt(form.number),
      section: form.section,
      capacity: parseInt(form.capacity),
    }

    if (editingTable) {
      const { error } = await supabase
        .from('tables')
        .update(data)
        .eq('id', editingTable.id)
      if (error) {
        toast.error(error.message.includes('unique') ? 'Table number already exists in this section' : 'Failed to update table')
        return
      }
      toast.success('Table updated')
    } else {
      const { error } = await supabase.from('tables').insert(data)
      if (error) {
        toast.error(error.message.includes('unique') ? 'Table number already exists in this section' : 'Failed to create table')
        return
      }
      toast.success('Table created')
    }

    setDialogOpen(false)
    loadTables()
  }

  async function bulkAddTables() {
    const from = parseInt(bulkForm.from)
    const to = parseInt(bulkForm.to)
    if (!from || !to || from > to) {
      toast.error('Invalid table range')
      return
    }
    if (to - from > 50) {
      toast.error('Maximum 50 tables at once')
      return
    }

    const supabase = createClient()
    const newTables = []
    for (let i = from; i <= to; i++) {
      newTables.push({
        number: i,
        section: bulkForm.section,
        capacity: parseInt(bulkForm.capacity),
      })
    }

    const { error } = await supabase.from('tables').insert(newTables)
    if (error) {
      toast.error('Some tables may already exist in this section')
      return
    }

    toast.success(`Added ${newTables.length} tables`)
    setBulkDialogOpen(false)
    loadTables()
  }

  async function deleteTable() {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('tables').delete().eq('id', deleteId)
    setDeleteId(null)
    toast.success('Table deleted')
    loadTables()
  }

  const getSectionLabel = (section: string) =>
    TABLE_SECTIONS.find(s => s.value === section)?.label || section

  // Group tables by section
  const groupedTables = TABLE_SECTIONS.map(section => ({
    section,
    tables: tables.filter(t => t.section === section.value),
  }))

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
        <h1 className="text-2xl font-bold">Table Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Bulk Add
          </Button>
          <Button onClick={openNewTable}>
            <Plus className="h-4 w-4 mr-2" />
            Add Table
          </Button>
        </div>
      </div>

      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No tables configured yet.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Use &quot;Bulk Add&quot; to quickly add multiple tables for each section.
            </p>
            <Button onClick={() => setBulkDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tables
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedTables.map(({ section, tables: sectionTables }) => (
            <Card key={section.value}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  {section.label}
                  <Badge variant="secondary">{sectionTables.length} tables</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sectionTables.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No tables in this section</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {sectionTables.map((table) => (
                      <div
                        key={table.id}
                        className={`border-2 rounded-lg p-3 text-center relative group ${TABLE_STATUS_COLORS[table.status]}`}
                      >
                        <p className="text-2xl font-bold">{getTableDisplayName(table)}</p>
                        <div className="flex items-center justify-center gap-1 text-xs mt-1">
                          <Users className="h-3 w-3" />
                          <span>{table.capacity}</span>
                        </div>
                        <p className="text-xs mt-1 capitalize">{table.status}</p>

                        {/* Hover actions */}
                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-white/80"
                            onClick={() => openEditTable(table)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-white/80 text-red-500"
                            onClick={() => setDeleteId(table.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single Table Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTable ? 'Edit Table' : 'Add Table'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Table Number</Label>
              <Input
                type="number"
                placeholder="e.g., 1"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={form.section}
                onValueChange={(v) => v != null && setForm({ ...form, section: v as TableSection })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_SECTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seating Capacity</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTable}>{editingTable ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add Tables</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Table #</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={bulkForm.from}
                  onChange={(e) => setBulkForm({ ...bulkForm, from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>To Table #</Label>
                <Input
                  type="number"
                  placeholder="15"
                  value={bulkForm.to}
                  onChange={(e) => setBulkForm({ ...bulkForm, to: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={bulkForm.section}
                onValueChange={(v) => v != null && setBulkForm({ ...bulkForm, section: v as TableSection })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_SECTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Capacity</Label>
              <Input
                type="number"
                value={bulkForm.capacity}
                onChange={(e) => setBulkForm({ ...bulkForm, capacity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={bulkAddTables}>Add Tables</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this table. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTable} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
