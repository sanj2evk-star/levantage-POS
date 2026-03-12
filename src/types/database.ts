export type UserRole = 'admin' | 'manager' | 'accountant' | 'cashier' | 'waiter'
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'
export type OrderType = 'dine_in' | 'takeaway'
export type TableStatus = 'available' | 'occupied' | 'reserved'
export type TableSection = 'coffee' | 'ground_floor' | 'ground_box' | 'first_floor' | 'first_box'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'split' | 'nc'
export type PaymentStatus = 'pending' | 'paid' | 'partial'
export type DiscountType = 'percent' | 'flat' | 'none'
export type StationType = 'kitchen' | 'cafe' | 'mocktail' | 'juice_bar' | 'billing'
export type RefundMode = 'cash' | 'upi' | 'card'
export type KOTStatus = 'pending' | 'preparing' | 'ready' | 'printed'

export interface Profile {
  id: string
  name: string
  role: UserRole
  phone: string | null
  pin: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  price: number
  description: string | null
  image_url: string | null
  is_active: boolean
  is_veg: boolean
  station: StationType
  created_at: string
  // Joined data
  category?: Category
  variants?: ItemVariant[]
  addons?: ItemAddon[]
}

export interface ItemVariant {
  id: string
  item_id: string
  name: string
  price_adjustment: number
  is_active: boolean
}

export interface ItemAddon {
  id: string
  name: string
  price: number
  category_id: string | null
  is_active: boolean
}

export interface Table {
  id: string
  number: number
  section: TableSection
  capacity: number
  status: TableStatus
  current_order_id: string | null
  created_at: string
}

export interface Order {
  id: string
  table_id: string | null
  order_number: string
  status: OrderStatus
  order_type: OrderType
  waiter_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  table?: Table
  waiter?: Profile
  items?: OrderItem[]
  bill?: Bill
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  kot_status: KOTStatus
  station: StationType
  is_cancelled: boolean
  cancel_reason: string | null
  created_at: string
  // Joined data
  menu_item?: MenuItem
  variant?: ItemVariant
  addons?: OrderItemAddon[]
}

export interface OrderItemAddon {
  id: string
  order_item_id: string
  addon_id: string
  price: number
  addon?: ItemAddon
}

export interface KOTEntry {
  id: string
  order_id: string
  station: StationType
  kot_number: string
  status: KOTStatus
  printed_at: string | null
  created_at: string
  // Joined data
  order?: Order
  items?: OrderItem[]
}

export interface Bill {
  id: string
  order_id: string
  subtotal: number
  gst_percent: number
  gst_amount: number
  service_charge: number
  service_charge_removed: boolean
  discount_amount: number
  discount_type: DiscountType
  discount_reason: string | null
  total: number
  total_refunded: number
  payment_mode: PaymentMode | null
  payment_status: PaymentStatus
  bill_number: string
  created_at: string
  // Joined data
  order?: Order
  payments?: Payment[]
  refunds?: Refund[]
}

export interface Payment {
  id: string
  bill_id: string
  mode: PaymentMode
  amount: number
  reference_number: string | null
  created_at: string
}

export interface PrintStation {
  id: string
  name: string
  station_type: StationType
  printer_ip: string
  port: number
  is_active: boolean
}

export interface Setting {
  key: string
  value: string
}

export interface DailyClosing {
  id: string
  date: string
  total_sales: number
  total_orders: number
  cash_total: number
  upi_total: number
  card_total: number
  closed_by: string
  created_at: string
  opening_balance: number
  actual_cash: number
  denomination_details: Record<string, number>
  short_surplus: number
  expected_cash: number
  cash_refunds: number
  refund_total: number
  partial_outstanding: number
  notes: string | null
  // Joined data
  closer?: Profile
}

export interface Refund {
  id: string
  bill_id: string
  amount: number
  reason: string
  refund_mode: RefundMode
  reference_number: string | null
  performed_by: string | null
  created_at: string
  // Joined data
  performer?: Profile
  bill?: Bill
}

// Cart types (frontend only)
export interface CartItem {
  menu_item: MenuItem
  variant: ItemVariant | null
  addons: ItemAddon[]
  quantity: number
  notes: string
  unit_price: number
  total_price: number
}
