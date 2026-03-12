'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, MenuItem, ItemVariant, StationType } from '@/types/database'
import { STATIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Leaf,
  CircleDot,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

export default function MenuManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')

  // Menu item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    description: '',
    category_id: '',
    is_veg: true,
    station: 'kitchen' as StationType,
  })

  // Variant dialog state
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [variantItemId, setVariantItemId] = useState<string | null>(null)
  const [variants, setVariants] = useState<ItemVariant[]>([])
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantPrice, setNewVariantPrice] = useState('')

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: 'category' | 'item'
    id: string
    name: string
  }>({ open: false, type: 'category', id: '', name: '' })

  // Active tab (category filter)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [catResult, itemResult] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*, category:categories(*)').order('name'),
    ])

    if (catResult.data) setCategories(catResult.data)
    if (itemResult.data) setMenuItems(itemResult.data as MenuItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---- CATEGORY CRUD ----
  async function saveCategory() {
    if (!categoryName.trim()) return
    const supabase = createClient()

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name: categoryName.trim() })
        .eq('id', editingCategory.id)

      if (error) {
        toast.error('Failed to update category')
        return
      }
      toast.success('Category updated')
    } else {
      const maxOrder = categories.length > 0
        ? Math.max(...categories.map(c => c.display_order)) + 1
        : 0

      const { error } = await supabase
        .from('categories')
        .insert({ name: categoryName.trim(), display_order: maxOrder })

      if (error) {
        toast.error('Failed to create category')
        return
      }
      toast.success('Category created')
    }

    setCategoryDialogOpen(false)
    setCategoryName('')
    setEditingCategory(null)
    loadData()
  }

  function openEditCategory(cat: Category) {
    setEditingCategory(cat)
    setCategoryName(cat.name)
    setCategoryDialogOpen(true)
  }

  function openNewCategory() {
    setEditingCategory(null)
    setCategoryName('')
    setCategoryDialogOpen(true)
  }

  async function toggleCategory(cat: Category) {
    const supabase = createClient()
    await supabase
      .from('categories')
      .update({ is_active: !cat.is_active })
      .eq('id', cat.id)
    loadData()
  }

  // ---- MENU ITEM CRUD ----
  function openNewItem() {
    setEditingItem(null)
    setItemForm({
      name: '',
      price: '',
      description: '',
      category_id: categories[0]?.id || '',
      is_veg: true,
      station: 'kitchen',
    })
    setItemDialogOpen(true)
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      price: item.price.toString(),
      description: item.description || '',
      category_id: item.category_id,
      is_veg: item.is_veg,
      station: item.station,
    })
    setItemDialogOpen(true)
  }

  async function saveItem() {
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.category_id) {
      toast.error('Please fill in all required fields')
      return
    }

    const supabase = createClient()
    const data = {
      name: itemForm.name.trim(),
      price: parseFloat(itemForm.price),
      description: itemForm.description.trim() || null,
      category_id: itemForm.category_id,
      is_veg: itemForm.is_veg,
      station: itemForm.station,
    }

    if (editingItem) {
      const { error } = await supabase
        .from('menu_items')
        .update(data)
        .eq('id', editingItem.id)

      if (error) {
        toast.error('Failed to update item')
        return
      }
      toast.success('Item updated')
    } else {
      const { error } = await supabase.from('menu_items').insert(data)

      if (error) {
        toast.error('Failed to create item')
        return
      }
      toast.success('Item created')
    }

    setItemDialogOpen(false)
    loadData()
  }

  async function toggleItem(item: MenuItem) {
    const supabase = createClient()
    await supabase
      .from('menu_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    loadData()
  }

  // ---- VARIANTS ----
  async function openVariants(itemId: string) {
    setVariantItemId(itemId)
    const supabase = createClient()
    const { data } = await supabase
      .from('item_variants')
      .select('*')
      .eq('item_id', itemId)
      .order('name')

    setVariants(data || [])
    setNewVariantName('')
    setNewVariantPrice('')
    setVariantDialogOpen(true)
  }

  async function addVariant() {
    if (!newVariantName.trim() || !newVariantPrice || !variantItemId) return
    const supabase = createClient()
    const { error } = await supabase.from('item_variants').insert({
      item_id: variantItemId,
      name: newVariantName.trim(),
      price_adjustment: parseFloat(newVariantPrice),
    })
    if (error) {
      toast.error('Failed to add variant')
      return
    }
    toast.success('Variant added')
    setNewVariantName('')
    setNewVariantPrice('')
    openVariants(variantItemId)
  }

  async function deleteVariant(variantId: string) {
    const supabase = createClient()
    await supabase.from('item_variants').delete().eq('id', variantId)
    if (variantItemId) openVariants(variantItemId)
    toast.success('Variant deleted')
  }

  // ---- DELETE ----
  async function confirmDelete() {
    const supabase = createClient()
    if (deleteDialog.type === 'category') {
      await supabase.from('categories').delete().eq('id', deleteDialog.id)
      toast.success('Category deleted')
    } else {
      await supabase.from('menu_items').delete().eq('id', deleteDialog.id)
      toast.success('Item deleted')
    }
    setDeleteDialog({ open: false, type: 'category', id: '', name: '' })
    loadData()
  }

  // Filter items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getStationLabel = (station: string) => {
    return STATIONS.find(s => s.value === station)?.label || station
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
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNewCategory}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={openNewItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Categories management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-gray-500 text-sm">No categories yet. Add your first category to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                    cat.is_active ? 'bg-white' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{cat.name}</span>
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={() => toggleCategory(cat)}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditCategory(cat)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    onClick={() =>
                      setDeleteDialog({
                        open: true,
                        type: 'category',
                        id: cat.id,
                        name: cat.name,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Menu Items ({filteredItems.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category filter tabs */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.filter(c => c.is_active).map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id}>
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filteredItems.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              {menuItems.length === 0
                ? 'No menu items yet. Add your first item to get started.'
                : 'No items match your filters.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${
                    item.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {item.is_veg ? (
                        <Leaf className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      <h3 className="font-medium">{item.name}</h3>
                    </div>
                    <p className="font-semibold text-amber-700">₹{item.price}</p>
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {item.category?.name || 'Uncategorized'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getStationLabel(item.station)}
                    </Badge>
                  </div>

                  <Separator className="mb-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() => toggleItem(item)}
                        className="scale-75"
                      />
                      <span className="text-xs text-gray-500">
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openVariants(item.id)}
                      >
                        Variants
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditItem(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            type: 'item',
                            id: item.id,
                            name: item.name,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                placeholder="e.g., Hot Beverages, Snacks, Main Course"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCategory()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCategory}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Menu Item' : 'New Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                placeholder="e.g., Cappuccino, Paneer Tikka"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={itemForm.category_id}
                  onValueChange={(v) => v != null && setItemForm({ ...itemForm, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.is_active).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>KOT Station *</Label>
              <Select
                value={itemForm.station}
                onValueChange={(v) => v != null && setItemForm({ ...itemForm, station: v as StationType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATIONS.map((station) => (
                    <SelectItem key={station.value} value={station.value}>
                      {station.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                KOT will be printed at this station
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={itemForm.is_veg}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_veg: v })}
              />
              <Label className="flex items-center gap-2">
                {itemForm.is_veg ? (
                  <>
                    <Leaf className="h-4 w-4 text-green-600" />
                    Vegetarian
                  </>
                ) : (
                  <>
                    <CircleDot className="h-4 w-4 text-red-600" />
                    Non-Vegetarian
                  </>
                )}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveItem}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variants Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manage Variants
              {variantItemId && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({menuItems.find(i => i.id === variantItemId)?.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {variants.length > 0 && (
              <div className="space-y-2">
                {variants.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{v.name}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {v.price_adjustment >= 0 ? '+' : ''}₹{v.price_adjustment}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => deleteVariant(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Input
                placeholder="Variant name (e.g., Large)"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="₹ +/-"
                value={newVariantPrice}
                onChange={(e) => setNewVariantPrice(e.target.value)}
                className="w-24"
              />
              <Button onClick={addVariant} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Use positive values for price increase (e.g., +30 for Large) or negative for decrease (e.g., -20 for Small)
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ ...deleteDialog, open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.name}&quot;?
              {deleteDialog.type === 'category' &&
                ' All items in this category will also be deleted.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
