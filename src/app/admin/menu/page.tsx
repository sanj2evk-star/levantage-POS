'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, MenuItem, ItemVariant, StationType } from '@/types/database'
import { STATIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Plus,
  Pencil,
  Trash2,
  Leaf,
  CircleDot,
  Search,
  X,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

  // Categories section collapsed
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false)

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
      category_id: activeCategory !== 'all' ? activeCategory : (categories[0]?.id || ''),
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

  // Count items per category
  const itemCountByCategory = menuItems.reduce((acc, item) => {
    acc[item.category_id] = (acc[item.category_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getStationLabel = (station: string) => {
    return STATIONS.find(s => s.value === station)?.label || station
  }

  const getStationColor = (station: string) => {
    switch (station) {
      case 'kitchen': return 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 border-orange-200 dark:border-orange-800'
      case 'cafe': return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 border-amber-200 dark:border-amber-800'
      case 'mocktail': return 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 border-purple-200'
      case 'juice_bar': return 'bg-green-50 dark:bg-green-900/30 text-green-700 border-green-200 dark:border-green-800'
      default: return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Menu Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} categories · {menuItems.length} items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openNewCategory}>
            <Plus className="h-4 w-4 mr-1.5" />
            Category
          </Button>
          <Button size="sm" onClick={openNewItem}>
            <Plus className="h-4 w-4 mr-1.5" />
            Item
          </Button>
        </div>
      </div>

      {/* Categories Section */}
      <div className="rounded-xl border bg-card">
        <button
          onClick={() => setCategoriesCollapsed(!categoriesCollapsed)}
          className="flex items-center justify-between w-full px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Categories</span>
            <Badge variant="secondary" className="text-xs">{categories.length}</Badge>
          </div>
          {categoriesCollapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!categoriesCollapsed && (
          <div className="px-4 pb-4 border-t pt-3">
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">No categories yet. Add your first category to get started.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors',
                      cat.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={() => toggleCategory(cat)}
                        className="scale-75 shrink-0"
                      />
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {itemCountByCategory[cat.id] || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Menu Items Section */}
      <div className="rounded-xl border bg-card">
        {/* Search + Filter Header */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Menu Items
              <span className="text-muted-foreground font-normal text-sm">({filteredItems.length})</span>
            </h2>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                activeCategory === 'all'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              )}
            >
              All ({menuItems.length})
            </button>
            {categories.filter(c => c.is_active).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  activeCategory === cat.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {cat.name} ({itemCountByCategory[cat.id] || 0})
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Items Grid */}
        <div className="p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">
                {menuItems.length === 0
                  ? 'No menu items yet. Add your first item to get started.'
                  : 'No items match your filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group rounded-lg border p-3.5 transition-all hover:shadow-sm',
                    item.is_active ? 'bg-card' : 'bg-muted/40 opacity-60'
                  )}
                >
                  {/* Top row: veg indicator + name + price */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={cn(
                      'mt-0.5 shrink-0 h-4 w-4 rounded-sm border flex items-center justify-center',
                      item.is_veg ? 'border-green-600' : 'border-red-600'
                    )}>
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        item.is_veg ? 'bg-green-600' : 'bg-red-600'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-snug">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                    </div>
                    <span className="font-semibold text-sm text-amber-700 shrink-0">₹{Math.round(item.price)}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {item.category?.name || 'Uncategorized'}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', getStationColor(item.station))}>
                      {getStationLabel(item.station)}
                    </span>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() => toggleItem(item)}
                        className="scale-[0.7] origin-left"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {item.is_active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => openVariants(item.id)}
                      >
                        Variants
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditItem(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
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
        </div>
      </div>

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
                autoFocus
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
        <DialogContent className="sm:max-w-lg">
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
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0"
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
                    <SelectValue placeholder="Select" />
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
              <p className="text-xs text-muted-foreground">
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

            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={itemForm.is_veg}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_veg: v })}
              />
              <Label className="flex items-center gap-2 cursor-pointer">
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
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({menuItems.find(i => i.id === variantItemId)?.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {variants.length > 0 ? (
              <div className="space-y-2">
                {variants.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{v.name}</span>
                      <Badge variant={v.price_adjustment >= 0 ? 'secondary' : 'outline'} className="text-xs">
                        {v.price_adjustment >= 0 ? '+' : ''}₹{v.price_adjustment}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={() => deleteVariant(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">No variants yet</p>
            )}

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Add a variant</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name (e.g., Large)"
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addVariant()}
                />
                <Input
                  type="number"
                  placeholder="₹ +/-"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                  className="w-24"
                  onKeyDown={(e) => e.key === 'Enter' && addVariant()}
                />
                <Button onClick={addVariant} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                +30 for price increase, -20 for decrease
              </p>
            </div>
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
