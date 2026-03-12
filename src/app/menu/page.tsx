'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, MenuItem } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Leaf, CircleDot, Coffee, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function PublicMenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cafeName, setCafeName] = useState('Le Vantage Cafe')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadMenu() {
      const supabase = createClient()

      const [catResult, itemResult, settingsResult] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('menu_items').select('*, category:categories(*)').eq('is_active', true).order('name'),
        supabase.from('settings').select('*').eq('key', 'cafe_name'),
      ])

      if (catResult.data) setCategories(catResult.data)
      if (itemResult.data) setMenuItems(itemResult.data as MenuItem[])
      if (settingsResult.data?.[0]) setCafeName(settingsResult.data[0].value)
      setLoading(false)
    }

    loadMenu()
  }, [])

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Group by category for display
  const groupedItems = categories
    .filter(cat => {
      if (activeCategory !== 'all') return cat.id === activeCategory
      return filteredItems.some(item => item.category_id === cat.id)
    })
    .map(cat => ({
      category: cat,
      items: filteredItems.filter(item => item.category_id === cat.id),
    }))
    .filter(group => group.items.length > 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50">
        <div className="text-center">
          <Coffee className="h-12 w-12 text-amber-700 mx-auto animate-pulse" />
          <p className="mt-4 text-amber-800">Loading menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Coffee className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-amber-900">{cafeName}</h1>
              <p className="text-xs text-gray-500">Menu</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-amber-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-amber-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Menu Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {groupedItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No items match your search.' : 'Menu is being updated.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedItems.map(({ category, items }) => (
              <section key={category.id}>
                <h2 className="text-lg font-bold text-amber-900 mb-4">
                  {category.name}
                </h2>
                <div className="space-y-3">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.is_veg ? (
                              <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-green-600">
                                <span className="h-2 w-2 rounded-full bg-green-600" />
                              </span>
                            ) : (
                              <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-red-600">
                                <span className="h-2 w-2 rounded-full bg-red-600" />
                              </span>
                            )}
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                          )}
                        </div>
                        <p className="text-lg font-bold text-amber-700 whitespace-nowrap">
                          ₹{item.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pb-8 text-center">
          <Separator className="mb-6" />
          <p className="text-sm text-gray-400">
            Prices inclusive of all taxes
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Powered by Le Vantage Cafe
          </p>
        </div>
      </main>
    </div>
  )
}
