const now = Date.now()
const ago = (minutes) => new Date(now - minutes * 60_000).toISOString()

export const DEMO_STORE_ID = 'demo-store-01'
export const demoStores = [
  { id: DEMO_STORE_ID, name: 'Kedai Rona', city: 'Bekasi', role: 'owner' },
  { id: 'demo-store-02', name: 'Rona Express', city: 'Jakarta Timur', role: 'owner' },
]

export const seedProducts = [
  { id: 'prd-01', name: 'Kopi Susu Aren', sku: 'MIN-001', barcode: '8991001000011', category: 'Minuman', price: 18000, cost: 9000, stock: 34, min_stock: 10, unit: 'cup', icon: '☕', color: 'peach' },
  { id: 'prd-02', name: 'Matcha Latte', sku: 'MIN-002', barcode: '8991001000012', category: 'Minuman', price: 22000, cost: 11500, stock: 6, min_stock: 10, unit: 'cup', icon: '🍵', color: 'mint' },
  { id: 'prd-03', name: 'Croissant Butter', sku: 'MAK-001', barcode: '8991001000013', category: 'Makanan', price: 16000, cost: 8000, stock: 18, min_stock: 6, unit: 'pcs', icon: '🥐', color: 'cream' },
  { id: 'prd-04', name: 'Americano', sku: 'MIN-003', barcode: '8991001000014', category: 'Minuman', price: 15000, cost: 6500, stock: 28, min_stock: 8, unit: 'cup', icon: '🧋', color: 'lilac' },
  { id: 'prd-05', name: 'Roti Cokelat', sku: 'MAK-002', barcode: '8991001000015', category: 'Makanan', price: 12000, cost: 5000, stock: 4, min_stock: 8, unit: 'pcs', icon: '🍞', color: 'peach' },
  { id: 'prd-06', name: 'Air Mineral 600ml', sku: 'MIN-004', barcode: '8991001000016', category: 'Minuman', price: 7000, cost: 2500, stock: 42, min_stock: 12, unit: 'botol', icon: '💧', color: 'blue' },
  { id: 'prd-07', name: 'Cookies Choco Chip', sku: 'MAK-003', barcode: '8991001000017', category: 'Makanan', price: 14000, cost: 6000, stock: 2, min_stock: 8, unit: 'pack', icon: '🍪', color: 'cream' },
  { id: 'prd-08', name: 'Teh Lemon', sku: 'MIN-005', barcode: '8991001000018', category: 'Minuman', price: 13000, cost: 5000, stock: 21, min_stock: 8, unit: 'cup', icon: '🍋', color: 'mint' },
  { id: 'prd-09', name: 'Sandwich Ayam', sku: 'MAK-004', barcode: '8991001000019', category: 'Makanan', price: 26000, cost: 14000, stock: 12, min_stock: 5, unit: 'pcs', icon: '🥪', color: 'lilac' },
  { id: 'prd-10', name: 'Cold Brew', sku: 'MIN-006', barcode: '8991001000020', category: 'Minuman', price: 24000, cost: 11000, stock: 9, min_stock: 8, unit: 'botol', icon: '🧊', color: 'blue' },
]

const makeSale = (id, receipt_no, minutes, cashier, payment_method, items, status = 'paid') => {
  const lineItems = items.map(([product_id, product_name, qty, unit_price]) => ({ product_id, product_name, qty, unit_price, subtotal: qty * unit_price }))
  return { id, receipt_no, created_at: ago(minutes), cashier_name: cashier, payment_method, status, subtotal: lineItems.reduce((sum, item) => sum + item.subtotal, 0), discount: 0, total: lineItems.reduce((sum, item) => sum + item.subtotal, 0), sale_items: lineItems }
}

export const seedSales = [
  makeSale('sal-01', 'TF-2601-0142', 12, 'Nadia Putri', 'qris', [['prd-01', 'Kopi Susu Aren', 2, 18000], ['prd-03', 'Croissant Butter', 1, 16000]]),
  makeSale('sal-02', 'TF-2601-0141', 39, 'Fajar Ramadhan', 'cash', [['prd-04', 'Americano', 1, 15000], ['prd-02', 'Matcha Latte', 1, 22000]]),
  makeSale('sal-03', 'TF-2601-0140', 73, 'Nadia Putri', 'qris', [['prd-09', 'Sandwich Ayam', 1, 26000], ['prd-08', 'Teh Lemon', 2, 13000]]),
  makeSale('sal-04', 'TF-2601-0139', 126, 'Fajar Ramadhan', 'cash', [['prd-01', 'Kopi Susu Aren', 1, 18000], ['prd-05', 'Roti Cokelat', 2, 12000]]),
  makeSale('sal-05', 'TF-2601-0138', 190, 'Nadia Putri', 'transfer', [['prd-10', 'Cold Brew', 1, 24000], ['prd-06', 'Air Mineral 600ml', 2, 7000]]),
  makeSale('sal-06', 'TF-2601-0137', 255, 'Fajar Ramadhan', 'cash', [['prd-03', 'Croissant Butter', 2, 16000], ['prd-08', 'Teh Lemon', 1, 13000]]),
]

export const seedEmployees = [
  { id: 'emp-01', name: 'Nadia Putri', email: 'nadia@keda rona.id'.replace(' ', ''), role: 'cashier', status: 'active', last_active: ago(8) },
  { id: 'emp-02', name: 'Fajar Ramadhan', email: 'fajar@tokoflow.demo', role: 'cashier', status: 'active', last_active: ago(23) },
  { id: 'emp-03', name: 'Dimas Saputra', email: 'dimas@tokoflow.demo', role: 'inventory', status: 'active', last_active: ago(80) },
]

export const idr = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
export const formatDate = (value, options = {}) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...options }).format(new Date(value))
export const paymentLabel = (value) => ({ cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }[value] || value || '—')
export const roleLabel = (value) => ({ owner: 'Pemilik', manager: 'Manajer', cashier: 'Kasir', inventory: 'Inventaris', viewer: 'Lihat saja' }[value] || value || '—')
