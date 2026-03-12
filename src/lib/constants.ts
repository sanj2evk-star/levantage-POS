export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Le Vantage Cafe'

export const GST_PERCENT = 5
export const SERVICE_CHARGE_PERCENT = 10

export const TABLE_SECTIONS = [
  { value: 'coffee', label: 'Coffee Section', prefix: 'C', group: 'coffee' },
  { value: 'ground_floor', label: 'Ground Floor', prefix: 'G', group: 'ground' },
  { value: 'ground_box', label: 'Ground Floor Box', prefix: 'GB', group: 'ground' },
  { value: 'first_floor', label: 'First Floor', prefix: 'F', group: 'first' },
  { value: 'first_box', label: 'First Floor Box', prefix: 'FB', group: 'first' },
] as const

export const TABLE_DISPLAY_GROUPS = [
  { group: 'coffee', label: 'Coffee Section', sections: ['coffee'] },
  { group: 'ground', label: 'Ground Floor', sections: ['ground_floor', 'ground_box'] },
  { group: 'first', label: 'First Floor', sections: ['first_floor', 'first_box'] },
] as const

export const STATIONS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'cafe', label: 'Cafe Counter' },
  { value: 'mocktail', label: 'Bar Counter' },
] as const

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'nc', label: 'NC' },
] as const

export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'preparing', label: 'Preparing', color: 'bg-blue-500' },
  { value: 'ready', label: 'Ready', color: 'bg-green-500' },
  { value: 'served', label: 'Served', color: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
] as const

export const DENOMINATIONS = [
  { value: 2000, label: '₹2000' },
  { value: 500, label: '₹500' },
  { value: 200, label: '₹200' },
  { value: 100, label: '₹100' },
  { value: 50, label: '₹50' },
  { value: 20, label: '₹20' },
  { value: 10, label: '₹10' },
  { value: 5, label: '₹5' },
  { value: 2, label: '₹2' },
  { value: 1, label: '₹1' },
] as const

export const TABLE_STATUS_COLORS = {
  available: 'bg-green-100 border-green-400 text-green-800',
  occupied: 'bg-red-100 border-red-400 text-red-800',
  reserved: 'bg-yellow-100 border-yellow-400 text-yellow-800',
} as const
