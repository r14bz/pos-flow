import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Barcode, Bell, Boxes,
  Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, ClipboardList, Cloud, Coffee, CreditCard, Download, ExternalLink, FileSpreadsheet,
  Filter, HelpCircle, Home, LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Menu, Moon,
  MoreHorizontal, Package, PackagePlus, Printer, QrCode, ScanLine, Search, Settings, ShieldCheck,
  ShoppingBag, ShoppingCart, Smartphone, Sun, Tag, TrendingDown, TrendingUp, Truck, Users,
  Wallet, X, Plus, Minus, Pencil, Trash2, RefreshCcw, Clock3, Banknote, Store, Wifi, WifiOff,
  BarChart3, CircleDollarSign, Mail, Camera, CheckCheck, DownloadCloud, Eye, EyeOff,
  AlertTriangle, SlidersHorizontal, Bluetooth, Zap, CalendarClock, KeyRound, ChevronUp,
  ReceiptText, Send, Globe
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import {
  DEMO_STORE_ID, demoStores, seedProducts, seedSales, seedEmployees, idr, formatDate,
  paymentLabel, roleLabel
} from './lib/demoData'
import * as XLSX from 'xlsx'

const primaryNav = [
  { key: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, roles: ['owner', 'manager', 'cashier', 'inventory', 'viewer'] },
  { key: 'cashier', label: 'Kasir', icon: ShoppingCart, roles: ['owner', 'cashier'] },
  { key: 'inventory', label: 'Inventaris', icon: Boxes, roles: ['owner', 'manager', 'inventory'] },
  { key: 'transactions', label: 'Transaksi', icon: ReceiptText, roles: ['owner', 'manager', 'cashier', 'viewer'] },
  { key: 'reports', label: 'Laporan', icon: BarChart3, roles: ['owner', 'manager', 'viewer'] },
  { key: 'employees', label: 'Karyawan', icon: Users, roles: ['owner', 'manager'] },
]
const secondaryNav = [
  { key: 'settings', label: 'Pengaturan toko', icon: Settings, roles: ['owner', 'manager'] },
  { key: 'admin', label: 'Administrator', icon: ShieldCheck, roles: ['admin'] },
]
const money = idr
const jakartaDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = (type) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const todayISO = () => jakartaDateKey(new Date())
const normaliseProduct = (row) => ({ ...row, min_stock: row.min_stock ?? 5, icon: row.icon || categoryIcon(row.category), color: row.color || categoryColor(row.category) })
const normaliseSale = (row) => ({ ...row, sale_items: row.sale_items || row.items || [], cashier_name: row.cashier_name || row.cashier?.full_name || 'Karyawan', status: row.status || 'paid' })
function categoryIcon(category) { return ({ Minuman: '☕', Makanan: '🥐', Sembako: '🛒', Aksesoris: '📦' }[category] || '📦') }
function categoryColor(category) { return ({ Minuman: 'peach', Makanan: 'cream', Sembako: 'mint', Aksesoris: 'lilac' }[category] || 'blue') }
function initials(name = 'TokoFlow') { return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() }
function getRolePage(key) { return key }

function IconButton({ icon: Icon, label, onClick, className = '', badge = false, disabled = false }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`icon-button ${className}`}>
    <Icon size={18} strokeWidth={1.8} />{badge && <i className="notification-dot" />}
  </button>
}

function Logo({ small = false, light = false }) {
  return <div className={`brand-lockup ${small ? 'brand-small' : ''} ${light ? 'brand-light' : ''}`}>
    <div className="brand-symbol"><ShoppingBag size={small ? 19 : 22} strokeWidth={2.2} /><span /></div>
    <div className="brand-wordmark"><strong>TokoFlow</strong><span>POS</span></div>
  </div>
}

function AuthScreen({ onDemo, onAuth, busy, error, setError }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [username, setUsername] = useState('')
  const [showPass, setShowPass] = useState(false)
  const submit = (e) => { e.preventDefault(); setError(''); onAuth({ mode, email, password, name, storeName, storeCode, username }) }
  return <div className="auth-screen">
    <section className="auth-story">
      <div className="auth-story-inner">
        <Logo light />
        <div className="auth-story-copy">
          <div className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> SISTEM KASIR TERPADU</div>
          <h1>Bisnis lancar,<br /><em>stok terkendali.</em></h1>
          <p>Semua toko, transaksi, dan laporan dalam satu tempat. Lebih rapi untuk Anda, lebih cepat untuk pelanggan.</p>
          <div className="auth-benefit-list">
            <div><span><Cloud size={17} /></span><section><strong>Data tersinkron otomatis</strong><small>Update toko secara real-time</small></section></div>
            <div><span><FileSpreadsheet size={17} /></span><section><strong>Laporan siap diunduh</strong><small>Rekap penjualan dalam Excel</small></section></div>
            <div><span><ShieldCheck size={17} /></span><section><strong>Data terpisah dan aman</strong><small>Akses berbasis peran pengguna</small></section></div>
          </div>
        </div>
        <div className="auth-story-footer"><span>© 2026 TokoFlow POS</span><span><LockKeyhole size={13} /> Dibuat untuk bisnis Indonesia</span></div>
      </div>
      <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
    </section>
    <section className="auth-form-side">
      <div className="auth-mobile-logo"><Logo /></div>
      <div className="auth-form-card">
        <div className="auth-form-heading">
          <span className="auth-greeting-icon"><Store size={21} /></span>
          <div className="eyebrow">RUANG KERJA ANDA</div>
          <h2>{mode === 'employee' ? 'Login karyawan' : mode === 'login' ? 'Selamat datang kembali' : 'Mulai kelola bisnis'}</h2>
          <p>{mode === 'employee' ? 'Masuk menggunakan kode toko dan akun yang diberikan pemilik.' : mode === 'login' ? 'Masuk untuk melanjutkan ke dashboard toko Anda.' : 'Buat akun untuk memulai dengan TokoFlow POS.'}</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <>
            <label>Nama lengkap<input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Anda" autoComplete="name" required /></label>
            <label>Nama toko<input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Contoh: Kedai Rona" required /></label>
          </>}
          {mode === 'employee' ? <>
            <label>Kode toko (ID toko)<input value={storeCode} onChange={e => setStoreCode(e.target.value.trim())} placeholder="Masukkan ID toko dari pemilik" required /></label>
            <label>Username<input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="username" autoComplete="username" minLength={3} required /></label>
          </> : <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" required /></label>}
          <label>Kata sandi<div className="password-input"><input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /><button type="button" aria-label="Tampilkan kata sandi" onClick={() => setShowPass(v => !v)}>{showPass ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {error && <div className="auth-error"><AlertTriangle size={16} />{error}</div>}
          {!isSupabaseConfigured && <div className="setup-hint"><Cloud size={17} /><span><strong>Mode pratinjau</strong><small>Hubungkan proyek Supabase di file .env agar login dan sinkronisasi aktif.</small></span></div>}
          <button className="button button-primary button-wide" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? <span className="spinner" /> : <LockKeyhole size={17} />}{mode === 'employee' ? 'Masuk sebagai karyawan' : mode === 'login' ? 'Masuk ke dashboard' : 'Buat akun dan toko'}</button>
        </form>
        {mode !== 'employee' && <div className="auth-switch">{mode === 'login' ? 'Belum memiliki akun?' : 'Sudah memiliki akun?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? 'Daftar sekarang' : 'Masuk'}</button></div>}
        <div className="auth-switch"><button onClick={() => { setMode(mode === 'employee' ? 'login' : 'employee'); setError('') }}>{mode === 'employee' ? 'Kembali ke login pemilik' : 'Login sebagai karyawan'}</button></div>
        <div className="auth-separator"><span /> <small>ATAU COBA DULU</small> <span /></div>
        <button className="button button-secondary button-wide" onClick={onDemo}><Activity size={17} />Buka demo interaktif</button>
        <p className="auth-footnote">Demo memakai data contoh di perangkat ini dan tidak terhubung ke toko nyata.</p>
      </div>
      <div className="auth-bottom-note"><ShieldCheck size={14} /> Sesi aman · Akses data dibatasi per toko</div>
    </section>
  </div>
}

function Modal({ title, subtitle, onClose, children, width = 'normal', noClose = false }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !noClose) onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, noClose])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !noClose) onClose?.() }}>
    <div className={`modal-card modal-${width}`} role="dialog" aria-modal="true">
      <div className="modal-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{!noClose && <IconButton icon={X} label="Tutup" onClick={onClose} />}</div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}

function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  useEffect(() => {
    let active = true
    let interval
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Browser ini tidak mendukung akses kamera. Masukkan barcode secara manual.'); return }
      if (!('BarcodeDetector' in window)) { setCameraError('Pemindai otomatis belum didukung browser ini. Masukkan barcode secara manual.'); return }
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!active) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setScanning(true) }
        interval = window.setInterval(async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) return
          try { const results = await detector.detect(videoRef.current); if (results?.[0]?.rawValue) { active = false; onDetected(results[0].rawValue) } } catch {}
        }, 300)
      } catch (err) { setCameraError(err?.message?.includes('Permission') ? 'Izin kamera ditolak. Izinkan akses kamera atau masukkan barcode manual.' : 'Kamera tidak dapat dibuka. Masukkan barcode secara manual.') }
    }
    start()
    return () => { active = false; clearInterval(interval); streamRef.current?.getTracks().forEach(track => track.stop()) }
  }, [onDetected])
  const submitManual = (e) => { e.preventDefault(); if (manualCode.trim()) onDetected(manualCode.trim()) }
  return <div className="scanner-modal-content">
    <div className="scanner-view">
      <video ref={videoRef} playsInline muted />
      {scanning && <div className="scan-frame"><span /><i /></div>}
      {!scanning && <div className="scanner-empty"><div className="scanner-empty-icon"><ScanLine size={31} /></div><strong>Kamera pemindai</strong><p>{cameraError || 'Menyiapkan kamera belakang…'}</p></div>}
      {scanning && <div className="scanner-instruction">Arahkan barcode ke dalam bingkai</div>}
    </div>
    <form className="manual-barcode-form" onSubmit={submitManual}><label>Atau masukkan kode secara manual</label><div className="search-input"><Barcode size={17} /><input autoFocus value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="Ketik barcode / SKU…" /><button type="submit" className="button button-primary button-sm">Gunakan</button></div></form>
  </div>
}

function ProductVisual({ product, large = false }) {
  return <div className={`product-visual ${product.color || categoryColor(product.category)} ${large ? 'product-visual-large' : ''}`}>{product.image_url ? <img src={product.image_url} alt={product.name || 'Gambar produk'} loading="lazy" /> : <span>{product.icon || categoryIcon(product.category)}</span>}{product.stock <= (product.min_stock ?? 5) && <i title="Stok menipis" />}</div>
}

function StatusPill({ status }) {
  const conf = status === 'paid' || status === 'active' ? ['status-green', status === 'active' ? 'Aktif' : 'Berhasil'] : status === 'suspended' ? ['status-red', 'Ditangguhkan'] : status === 'pending' ? ['status-yellow', 'Menunggu'] : status === 'cancelled' ? ['status-red', 'Dibatalkan'] : ['status-gray', status || '—']
  return <span className={`status-pill ${conf[0]}`}><i />{conf[1]}</span>
}

function EmptyState({ icon: Icon = Package, title, text, action }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon size={24} /></div><strong>{title}</strong><p>{text}</p>{action}</div>
}

function KPI({ icon: Icon, label, value, trend, trendLabel, tone = 'green', trendDown = false }) {
  return <div className="kpi-card"><div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={19} /></span></div><strong className="kpi-value">{value}</strong><div className="kpi-foot">{trend !== undefined && <span className={`kpi-trend ${trendDown ? 'down' : 'up'}`}>{trendDown ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{trend}</span>}<span>{trendLabel}</span></div></div>
}

function SalesChart({ sales }) {
  const data = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const sum = (sales || []).filter(s => (s.status === 'paid' || s.status === 'completed') && jakartaDateKey(s.created_at) === jakartaDateKey(d)).reduce((a, s) => a + Number(s.total || 0), 0)
      days.push({ key, label: d.toLocaleDateString('id-ID', { weekday: 'short' }), value: sum })
    }
    return days
  }, [sales])
  const max = Math.max(1, ...data.map(d => d.value))
  const points = data.map((d, i) => ({ ...d, x: 20 + i * 54, y: 105 - (d.value / max) * 78 }))
  const line = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `20,112 ${line} 344,112`
  return <div className="sales-chart-wrap">
    <div className="chart-y-labels"><span>{idr(max).replace(',00', '')}</span><span>{idr(max / 2).replace(',00', '')}</span><span>Rp0</span></div>
    <svg className="sales-chart" viewBox="0 0 364 128" preserveAspectRatio="none" role="img" aria-label="Grafik penjualan tujuh hari terakhir">
      <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--accent)" stopOpacity=".01"/></linearGradient></defs>
      {[20, 47, 74, 101].map(y => <line key={y} x1="10" x2="354" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 4" />)}
      <polygon points={area} fill="url(#salesFill)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={p.key} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? 'var(--surface)' : 'var(--accent)'} stroke="var(--accent)" strokeWidth={i === points.length - 1 ? 2 : 0} />)}
    </svg>
    <div className="chart-x-labels">{data.map(d => <span key={d.key}>{d.label}</span>)}</div>
  </div>
}

function PageTitle({ eyebrow, title, description, actions }) {
  return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-title-actions">{actions}</div>}</div>
}

function App() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('tokoflow-theme') || 'light' } catch { return 'light' } })
  const [page, setPage] = useState(window.location.pathname === '/cashier' ? 'cashier' : 'dashboard')
  const [session, setSession] = useState(null)
  const [demo, setDemo] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [profile, setProfile] = useState(null)
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [cart, setCart] = useState([])
  const [cartSearch, setCartSearch] = useState('')
  const [cartCategory, setCartCategory] = useState('Semua')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cartDiscount, setCartDiscount] = useState('0')
  const [cashReceived, setCashReceived] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategory, setStockCategory] = useState('Semua')
  const [reportDate, setReportDate] = useState(todayISO())
  const [savingForm, setSavingForm] = useState(false)
  const [productDraft, setProductDraft] = useState({ name: '', sku: '', barcode: '', category: 'Minuman', image_url: '', price: '', cost: '', stock: '', min_stock: '5', unit: 'pcs' })
  const [employeeDraft, setEmployeeDraft] = useState({ name: '', username: '', password: '', roles: ['cashier'] })
  const [employeeResetPassword, setEmployeeResetPassword] = useState('')
  const [employeeRolesDraft, setEmployeeRolesDraft] = useState([])
  const [stockDraft, setStockDraft] = useState({ product_id: '', qty_delta: '1', note: '' })
  const [storeDraft, setStoreDraft] = useState({ name: '', city: '' })
  const [priceDraft, setPriceDraft] = useState({ product_id: '', price: '' })
  const [qrisState, setQrisState] = useState(null)
  const [qrisSettingsDraft, setQrisSettingsDraft] = useState({ mode: 'static', merchant_display_name: '', provider_merchant_id: '', provider_server_key: '', provider_is_production: false })
  const [qrisSavedSettings, setQrisSavedSettings] = useState(null)
  const [qrisStaticFile, setQrisStaticFile] = useState(null)
  const [qrisSettingsBusy, setQrisSettingsBusy] = useState(false)
  const [qrisCheckoutMode, setQrisCheckoutMode] = useState('dynamic')
  const [scannerTarget, setScannerTarget] = useState('cashier')
  const [receiptToShow, setReceiptToShow] = useState(null)
  const [adminStores, setAdminStores] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [adminAuditLogs, setAdminAuditLogs] = useState([])
  const [adminSearch, setAdminSearch] = useState('')
  const [adminTab, setAdminTab] = useState('stores')
  const [adminBusyStoreId, setAdminBusyStoreId] = useState('')
  const [storeCodeDraft, setStoreCodeDraft] = useState('')
  const [storeCodeBusy, setStoreCodeBusy] = useState(false)
  const toastTimer = useRef(null)
  const storeProvisionPromise = useRef(null)
  const isCashierPage = page === 'cashier'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('tokoflow-theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    const onInstall = (event) => { event.preventDefault(); setDeferredPrompt(event) }
    const onPop = () => setPage(window.location.pathname === '/cashier' ? 'cashier' : 'dashboard')
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('popstate', onPop)
    if (!supabase) { setAuthLoading(false); return () => { window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('popstate', onPop) } }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) }).catch(() => setAuthLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (!nextSession) { setProfile(null); setStores([]); setStoreId('') } })
    return () => { window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('popstate', onPop); listener?.subscription?.unsubscribe() }
  }, [])

  // Resetting an employee password revokes their existing session server-side.
  // Poll the session validity RPC so an already-open app also signs out promptly.
  useEffect(() => {
    const isEmployeeSession = Boolean(session?.user?.user_metadata?.employee_account)
    if (!supabase || !session?.user?.id || !isEmployeeSession || demo) return
    let active = true
    let checking = false
    const checkSession = async () => {
      if (checking || !active) return
      checking = true
      try {
        const { data, error } = await supabase.rpc('employee_session_is_valid')
        if (active && !error && data === false) {
          await supabase.auth.signOut({ scope: 'local' })
          if (active) showToast('Sesi Anda telah dicabut. Silakan masuk kembali dengan kata sandi terbaru.', 'error')
        }
      } catch {
        // A transient network/RPC error must not sign out a valid employee.
      } finally {
        checking = false
      }
    }
    checkSession()
    const timer = window.setInterval(checkSession, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [session?.access_token, session?.user?.id, session?.user?.user_metadata?.employee_account, demo])

  useEffect(() => {
    if (demo) {
      setStores(demoStores)
      setStoreId(current => current || DEMO_STORE_ID)
      setProfile({ full_name: 'Ria Aditya', is_super_admin: true, role: 'owner' })
      setAuthLoading(false)
      return
    }
    if (!session?.user || !supabase) return
    let alive = true
    const hydrate = async () => {
      setLoadingData(true)
      const [profileRes, memberRes, extraRolesRes] = await Promise.all([
        supabase.from('profiles').select('full_name,is_super_admin').eq('id', session.user.id).maybeSingle(),
        supabase.from('store_memberships').select('store_id,role,stores(id,name,city,created_at,owner_id)').eq('user_id', session.user.id),
        supabase.from('store_membership_roles').select('store_id,role').eq('user_id', session.user.id),
      ])
      if (!alive) return
      if (profileRes.data) setProfile(profileRes.data)
      if (memberRes.error) showToast(`Gagal memuat toko: ${memberRes.error.message}`, 'error')
      let memberships = memberRes.data || []
      const requestedStoreName = String(session.user.user_metadata?.store_name || '').trim()
      if (!memberRes.error && memberships.length === 0 && requestedStoreName) {
        if (!storeProvisionPromise.current) {
          storeProvisionPromise.current = (async () => {
            const { data: newStore, error } = await supabase.rpc('create_store', { p_name: requestedStoreName, p_city: '' })
            if (error) throw error
            return { store_id: newStore.id, role: 'owner', stores: newStore }
          })()
        }
        try { memberships = [await storeProvisionPromise.current] }
        catch (error) { showToast(`Toko awal belum dapat dibuat: ${error?.message || 'coba lagi dari formulir toko.'}`, 'error') }
        finally { storeProvisionPromise.current = null }
      }
      const extraRoles = extraRolesRes.data || []
      const nextStores = memberships.filter(m => m.stores).map(m => ({ ...m.stores, role: m.role, roles: [...new Set([m.role, ...extraRoles.filter(r => r.store_id === m.store_id).map(r => r.role)])] }))
      setStores(nextStores)
      setStoreId(current => nextStores.some(s => s.id === current) ? current : (nextStores[0]?.id || ''))
      if (profileRes.data?.is_super_admin) loadAdminSummary()
      setLoadingData(false)
    }
    hydrate()
    return () => { alive = false }
  }, [session, demo])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3600)
  }, [])

  const loadAdminSummary = useCallback(async () => {
    if (!supabase) return
    const [{ data: allStores, error: storesError }, { data: allProfiles, error: profilesError }, { data: auditRows, error: auditError }] = await Promise.all([
      supabase.from('stores').select('id,name,city,status,store_code,owner_id,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id,full_name,created_at,is_super_admin').order('created_at', { ascending: false }).limit(200),
      supabase.from('admin_audit_logs').select('id,actor_id,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(100),
    ])
    if (storesError) showToast(`Gagal memuat daftar toko: ${storesError.message}`, 'error')
    if (profilesError) showToast(`Gagal memuat daftar akun: ${profilesError.message}`, 'error')
    if (auditError) showToast(`Riwayat audit belum tersedia. Pastikan migrasi database sudah diterapkan. (${auditError.message})`, 'error')
    setAdminStores(allStores || [])
    setAdminUsers(allProfiles || [])
    setAdminAuditLogs(auditRows || [])
  }, [showToast])

  const setAdminStoreStatus = useCallback(async (store) => {
    if (!supabase || !store?.id || !isSuperAdmin) return
    const nextStatus = store.status === 'suspended' ? 'active' : 'suspended'
    const actionLabel = nextStatus === 'suspended' ? 'menangguhkan' : 'mengaktifkan kembali'
    const confirmed = window.confirm(`Yakin ingin ${actionLabel} toko "${store.name}"? ${nextStatus === 'suspended' ? 'Anggota toko tidak dapat mengakses data selama status ditangguhkan.' : 'Akses anggota toko akan dipulihkan.'}`)
    if (!confirmed) return
    setAdminBusyStoreId(store.id)
    const { error } = await supabase.rpc('admin_set_store_status', { p_store_id: store.id, p_status: nextStatus })
    setAdminBusyStoreId('')
    if (error) {
      showToast(`Status toko gagal diubah: ${error.message}`, 'error')
      return
    }
    showToast(nextStatus === 'suspended' ? 'Toko berhasil ditangguhkan.' : 'Toko berhasil diaktifkan kembali.')
    await loadAdminSummary()
  }, [profile?.is_super_admin, demo, loadAdminSummary, showToast])

  const currentStore = stores.find(s => s.id === storeId) || (demo ? demoStores.find(s => s.id === storeId) : null) || stores[0] || null
  useEffect(() => { setStoreCodeDraft(currentStore?.store_code || '') }, [currentStore?.id, currentStore?.store_code])

  const saveStoreCode = useCallback(async () => {
    if (!supabase || !currentStore?.id || !isStoreOwner || demo) return
    setStoreCodeBusy(true)
    const { data, error } = await supabase.rpc('owner_update_store_code', { p_store_id: currentStore.id, p_store_code: storeCodeDraft })
    setStoreCodeBusy(false)
    if (error) { showToast(`ID toko gagal disimpan: ${error.message}`, 'error'); return }
    setStores(rows => rows.map(row => row.id === data.id ? { ...row, store_code: data.store_code } : row))
    setStoreCodeDraft(data.store_code)
    showToast('ID toko berhasil diperbarui. UUID internal dan data transaksi tetap aman.')
  }, [currentStore?.id, isStoreOwner, demo, storeCodeDraft, showToast])
  const currentRole = currentStore?.role || (demo ? 'owner' : 'viewer')
  const currentRoles = currentStore?.roles || [currentRole]
  const isStoreOwner = Boolean(demo || (currentStore?.role === 'owner' && currentStore?.owner_id === session?.user?.id) || (currentStore?.role === 'owner' && !session?.user?.user_metadata?.employee_account))
  const isSuperAdmin = Boolean(profile?.is_super_admin || demo)
  const displayName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Pemilik Toko'
  const canUseCashier = Boolean(demo || isStoreOwner || currentRoles.includes('cashier'))
  const visibleNav = [...primaryNav, ...secondaryNav].filter(item => item.roles.includes('admin') ? isSuperAdmin : item.roles.some(role => currentRoles.includes(role)))

  const loadStoreData = useCallback(async (id = storeId) => {
    if (demo) {
      const productCopies = seedProducts.map((p, i) => ({ ...p, id: id === DEMO_STORE_ID ? p.id : `store-b-${p.id}`, stock: id === DEMO_STORE_ID ? p.stock : Math.max(0, p.stock + (i % 4) - 2) }))
      const saleCopies = seedSales.map((s, i) => ({ ...s, id: id === DEMO_STORE_ID ? s.id : `store-b-${s.id}`, receipt_no: id === DEMO_STORE_ID ? s.receipt_no : s.receipt_no.replace('TF-', 'TB-') }))
      setProducts(productCopies)
      setSales(saleCopies)
      setEmployees(seedEmployees.map(e => ({ ...e })))
      return
    }
    if (!supabase || !id || !session?.user) { setProducts([]); setSales([]); setEmployees([]); return }
    setLoadingData(true)
    const [productRes, salesRes, employeeRes, extraRolesRes] = await Promise.all([
      supabase.from('products').select('*').eq('store_id', id).order('name'),
      supabase.from('sales').select('*,sale_items(*)').eq('store_id', id).order('created_at', { ascending: false }).limit(500),
      supabase.from('employees').select('*').eq('store_id', id).order('name'),
      supabase.from('store_membership_roles').select('user_id,role').eq('store_id', id),
    ])
    if (productRes.error) showToast(`Inventaris: ${productRes.error.message}`, 'error')
    if (salesRes.error) showToast(`Transaksi: ${salesRes.error.message}`, 'error')
    setProducts((productRes.data || []).map(normaliseProduct))
    setSales((salesRes.data || []).map(normaliseSale))
    const extrasByUser = new Map()
    if (!extraRolesRes.error) (extraRolesRes.data || []).forEach(item => {
      extrasByUser.set(item.user_id, [...(extrasByUser.get(item.user_id) || []), item.role])
    })
    setEmployees((employeeRes.data || []).map(employee => ({
      ...employee,
      roles: [...new Set([employee.role, ...(extrasByUser.get(employee.user_id) || [])].filter(Boolean))],
    })))
    setLoadingData(false)
  }, [demo, storeId, session, showToast])

  useEffect(() => {
    if (demo || !supabase || !storeId || !session) return
    let alive = true
    supabase.from('store_qris_settings').select('mode,static_qr_storage_path,merchant_display_name,provider,provider_merchant_id,provider_is_production,dynamic_status')
      .eq('store_id', storeId).maybeSingle().then(({ data }) => {
        if (!alive) return
        const saved = data || null
        setQrisSavedSettings(saved)
        if (saved) {
          setQrisSettingsDraft(current => ({ ...current, mode: saved.mode || 'static', merchant_display_name: saved.merchant_display_name || '', provider_merchant_id: saved.provider_merchant_id || '', provider_server_key: '', provider_is_production: Boolean(saved.provider_is_production) }))
          setQrisCheckoutMode(saved.mode === 'static' ? 'static' : 'dynamic')
        } else {
          setQrisSavedSettings(null)
          setQrisSettingsDraft(current => ({ ...current, mode: 'static', provider_server_key: '' }))
        }
      })
    return () => { alive = false }
  }, [demo, storeId, session?.user?.id])

  useEffect(() => {
    if (!session && !demo) return
    if (demo) { if (storeId) loadStoreData(storeId); return }
    if (!storeId || !supabase) return
    loadStoreData(storeId)
    const channel = supabase.channel(`store-live-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${storeId}` }, () => loadStoreData(storeId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `store_id=eq.${storeId}` }, () => loadStoreData(storeId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId, demo, session?.user?.id])

  useEffect(() => {
    if (!modal || modal.type !== 'qris' || demo || !supabase || !modal.sale_id) return
    let alive = true
    const poll = async () => {
      const { data } = await supabase.from('sales').select('*,sale_items(*)').eq('id', modal.sale_id).maybeSingle()
      if (!alive || !data) return
      if (data.status === 'paid') {
        await loadStoreData(storeId)
        setCart([]); setCartDiscount('0'); setCashReceived('')
        setModal({ type: 'receipt', sale: normaliseSale(data) })
        showToast('Pembayaran QRIS berhasil diterima.')
      } else if (data.status === 'cancelled') {
        setModal(null); showToast('Pembayaran QRIS dibatalkan atau kedaluwarsa.', 'error')
        await loadStoreData(storeId)
      }
    }
    const timer = window.setInterval(poll, 3000); poll()
    return () => { alive = false; window.clearInterval(timer) }
  }, [modal?.type, modal?.sale_id, demo, storeId, loadStoreData, showToast])

  const onAuth = async ({ mode, email, password, name, storeName, storeCode, username }) => {
    setAuthError('')
    if (!supabase) { setAuthError('Supabase belum dikonfigurasi. Gunakan demo atau lengkapi file .env.'); return }
    setAuthBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, store_name: storeName } } })
        if (error) throw error
        if (data.session) {
          setSession(data.session)
          showToast('Akun berhasil dibuat. Menyiapkan toko pertama…', 'info')
        } else {
          setAuthError('Pendaftaran berhasil. Periksa email Anda untuk konfirmasi, lalu masuk kembali.')
        }
      } else if (mode === 'employee') {
        const enteredStoreCode = String(storeCode || '').trim()
        const cleanUsername = String(username || '').trim().toLowerCase()
        if (!enteredStoreCode) throw new Error('Masukkan ID toko yang diberikan pemilik.')
        if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) throw new Error('Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.')
        // Resolve the human-friendly code to the immutable UUID used by employee auth identities.
        let cleanStoreId = enteredStoreCode
        if (!/^[0-9a-f-]{36}$/i.test(enteredStoreCode)) {
          const { data: storeMatch, error: storeLookupError } = await supabase.from('stores').select('id').ilike('store_code', enteredStoreCode).maybeSingle()
          if (storeLookupError || !storeMatch?.id) throw new Error('ID toko tidak ditemukan. Periksa kembali ID toko yang diberikan pemilik.')
          cleanStoreId = storeMatch.id
        }
        const employeeEmail = `emp-${cleanUsername}@${cleanStoreId}.employee.invalid`
        const { data, error } = await supabase.auth.signInWithPassword({ email: employeeEmail, password })
        if (error) throw new Error('Login gagal. Periksa kode toko, username, dan kata sandi.')
        const metadata = data.user?.user_metadata || data.session?.user?.user_metadata || {}
        if (metadata.employee_account !== true || metadata.employee_store_id !== cleanStoreId) { await supabase.auth.signOut(); throw new Error('Akun ini bukan akun karyawan untuk toko tersebut.') }
        setSession(data.session)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setSession(data.session)
      }
    } catch (err) { setAuthError(err?.message || 'Autentikasi gagal.') }
    finally { setAuthBusy(false) }
  }

  const startDemo = () => {
    setDemo(true); setSession({ user: { id: 'demo-user', email: 'demo@tokoflow.local', user_metadata: { full_name: 'Ria Aditya' } } })
    setStores(demoStores); setStoreId(DEMO_STORE_ID); setProfile({ full_name: 'Ria Aditya', is_super_admin: true, role: 'owner' })
    setProducts(seedProducts.map(p => ({ ...p }))); setSales(seedSales.map(s => ({ ...s }))); setEmployees(seedEmployees.map(e => ({ ...e })))
    setPage('dashboard'); window.history.replaceState({}, '', '/'); showToast('Mode demo aktif. Data contoh siap digunakan.')
  }

  const signOut = async () => {
    if (!demo && supabase) await supabase.auth.signOut()
    setDemo(false); setSession(null); setStores([]); setStoreId(''); setProducts([]); setSales([]); setEmployees([]); setCart([]); setPage('dashboard'); window.history.replaceState({}, '', '/')
  }

  const navigate = (next) => {
    if (next === 'cashier' && !canUseCashier) {
      showToast('Akses kasir tidak tersedia untuk akun ini. Hubungi pemilik toko jika memerlukan izin kasir.', 'error')
      setPage('dashboard')
      if (window.location.pathname !== '/') window.history.replaceState({}, '', '/')
      setSidebarOpen(false)
      return
    }
    setPage(next); setSidebarOpen(false); setNotificationOpen(false)
    const path = next === 'cashier' ? '/cashier' : '/'
    if (window.location.pathname !== path) window.history.pushState({ page: next }, '', path)
  }

  const installApp = async () => {
    if (!deferredPrompt) { showToast('Untuk memasang aplikasi, buka menu browser lalu pilih “Tambahkan ke layar utama”.', 'info'); return }
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  const notifications = useMemo(() => {
    const low = products.filter(p => Number(p.stock) <= Number(p.min_stock ?? 5))
    const recent = sales.filter(s => jakartaDateKey(s.created_at) === todayISO() && s.status === 'paid')
    return [
      ...low.slice(0, 5).map(p => ({ id: `low-${p.id}`, type: 'warning', title: 'Stok menipis', body: `${p.name} tersisa ${p.stock} ${p.unit || 'unit'}`, time: 'Perlu ditindaklanjuti' })),
      ...(recent.length ? [{ id: 'daily-report', type: 'success', title: 'Ringkasan penjualan hari ini', body: `${recent.length} transaksi · ${idr(recent.reduce((a, s) => a + Number(s.total || 0), 0))}`, time: 'Diperbarui otomatis' }] : []),
    ]
  }, [products, sales])

  const categories = useMemo(() => ['Semua', ...new Set(products.map(p => p.category).filter(Boolean))], [products])
  const filteredProducts = useMemo(() => products.filter(p => {
    const query = stockSearch.trim().toLowerCase()
    const matchesQuery = !query || [p.name, p.sku, p.barcode, p.category].some(x => String(x || '').toLowerCase().includes(query))
    return matchesQuery && (stockCategory === 'Semua' || p.category === stockCategory)
  }), [products, stockSearch, stockCategory])

  const addToCart = (product) => {
    const existing = cart.find(i => i.product.id === product.id)
    const qty = existing ? existing.qty + 1 : 1
    if (qty > Number(product.stock)) { showToast(`Stok ${product.name} tidak mencukupi.`, 'error'); return }
    setCart(current => existing ? current.map(i => i.product.id === product.id ? { ...i, qty } : i) : [...current, { product, qty }])
  }
  const changeCartQty = (productId, nextQty) => {
    const item = cart.find(i => i.product.id === productId)
    if (!item) return
    if (nextQty < 1) { setCart(current => current.filter(i => i.product.id !== productId)); return }
    if (nextQty > Number(item.product.stock)) { showToast(`Stok maksimal ${item.product.stock} ${item.product.unit || 'unit'}.`, 'error'); return }
    setCart(current => current.map(i => i.product.id === productId ? { ...i, qty: nextQty } : i))
  }
  const cartSubtotal = cart.reduce((sum, item) => sum + Number(item.product.price || 0) * item.qty, 0)
  const discountAmount = Math.min(cartSubtotal, Math.max(0, Number(cartDiscount || 0)))
  const cartTotal = Math.max(0, cartSubtotal - discountAmount)
  const cartItemsForRpc = cart.map(({ product, qty }) => ({ product_id: product.id, qty }))

  const checkout = async () => {
    if (!canUseCashier) return showToast('Akses kasir tidak tersedia untuk akun ini.', 'error')
    if (!cart.length) return showToast('Keranjang masih kosong.', 'error')
    if (!currentStore?.id) return showToast('Pilih atau buat toko terlebih dahulu.', 'error')
    setCheckoutBusy(true)
    try {
      if (paymentMethod === 'qris') {
        if (!demo) {
          const { data: settings, error: settingsError } = await supabase.from('store_qris_settings').select('mode').eq('store_id', currentStore.id).maybeSingle()
          if (settingsError) throw settingsError
          const selectedMode = settings?.mode === 'static' ? 'static' : settings?.mode === 'both' ? qrisCheckoutMode : 'dynamic'
          const functionName = selectedMode === 'static' ? 'create-static-qris-sale' : 'create-qris-payment'
          const { data, error } = await supabase.functions.invoke(functionName, { body: { store_id: currentStore.id, items: cartItemsForRpc, discount: discountAmount } })
          if (error) throw error
          if (data?.error) throw new Error(data.error)
          setModal({ type: 'qris', qris_mode: selectedMode, sale_id: data.sale_id, receipt_no: data.receipt_no, total: data.total, qr_string: data.qr_string, qr_url: data.qr_url, expires_at: data.expires_at, order_id: data.order_id, merchant_display_name: data.merchant_display_name })
        } else {
          setModal({ type: 'qris', demo: true, qris_mode: 'dynamic', sale_id: `demo-qris-${Date.now()}`, receipt_no: `TF-${todayISO().replaceAll('-', '').slice(2)}-${String(sales.length + 1).padStart(4, '0')}`, total: cartTotal, qr_string: 'TOKOFLOW-DEMO-QRIS-NOT-A-REAL-PAYMENT' })
        }
        return
      }
      let sale
      if (demo) {
        const newSale = {
          id: `demo-sale-${Date.now()}`, store_id: currentStore.id,
          receipt_no: `TF-${todayISO().replaceAll('-', '').slice(2)}-${String(sales.length + 1).padStart(4, '0')}`,
          created_at: new Date().toISOString(), cashier_name: displayName, payment_method: paymentMethod,
          status: 'paid', subtotal: cartSubtotal, discount: discountAmount, total: cartTotal,
          sale_items: cart.map(({ product, qty }) => ({ product_id: product.id, product_name: product.name, qty, unit_price: Number(product.price), subtotal: Number(product.price) * qty })),
        }
        setProducts(current => current.map(p => { const match = cart.find(i => i.product.id === p.id); return match ? { ...p, stock: p.stock - match.qty } : p }))
        setSales(current => [newSale, ...current]); sale = newSale
      } else {
        const { data: saleId, error } = await supabase.rpc('checkout_sale', { p_store_id: currentStore.id, p_items: cartItemsForRpc, p_payment_method: paymentMethod, p_discount: discountAmount })
        if (error) throw error
        const { data, error: saleError } = await supabase.from('sales').select('*,sale_items(*)').eq('id', saleId).single()
        if (saleError) throw saleError
        sale = normaliseSale(data)
        await loadStoreData(storeId)
        for (const line of sale.sale_items || []) if (line.product_id) supabase.functions.invoke('notify-low-stock', { body: { store_id: storeId, product_id: line.product_id } }).catch(() => {})
      }
      setCart([]); setCartDiscount('0'); setCashReceived('')
      setModal({ type: 'receipt', sale })
      showToast('Transaksi berhasil disimpan.')
    } catch (err) { showToast(err?.message || 'Transaksi gagal diproses.', 'error') }
    finally { setCheckoutBusy(false) }
  }

  const confirmDemoQris = async () => {
    if (!canUseCashier) return showToast('Akses kasir tidak tersedia untuk akun ini.', 'error')
    const sale = {
      id: modal.sale_id, store_id: currentStore.id, receipt_no: modal.receipt_no,
      created_at: new Date().toISOString(), cashier_name: displayName, payment_method: 'qris', status: 'paid',
      subtotal: cartSubtotal, discount: discountAmount, total: cartTotal,
      sale_items: cart.map(({ product, qty }) => ({ product_id: product.id, product_name: product.name, qty, unit_price: Number(product.price), subtotal: Number(product.price) * qty })),
    }
    setProducts(current => current.map(p => { const match = cart.find(i => i.product.id === p.id); return match ? { ...p, stock: p.stock - match.qty } : p }))
    setSales(current => [sale, ...current]); setCart([]); setCartDiscount('0'); setCashReceived('')
    setModal({ type: 'receipt', sale }); showToast('Simulasi QRIS berhasil. Ini bukan pembayaran sungguhan.')
  }

  const showScanner = (target = 'cashier') => { setScannerTarget(target); setModal({ type: 'scanner' }) }
  const onBarcodeDetected = useCallback((code) => {
    if (scannerTarget === 'product') {
      setProductDraft(current => ({ ...current, barcode: code }))
      setModal({ type: 'product' })
      showToast(`Barcode ${code} dimasukkan ke formulir barang.`)
      return
    }
    setModal(null)
    if (scannerTarget === 'inventory') {
      setStockCategory('Semua')
      setStockSearch(code)
      showToast(`Inventaris difilter dengan barcode ${code}.`)
      return
    }
    const product = products.find(p => String(p.barcode) === String(code) || String(p.sku).toLowerCase() === String(code).toLowerCase())
    if (product) { addToCart(product); showToast(`${product.name} ditambahkan ke keranjang.`) }
    else { setCartSearch(code); showToast(`Barcode ${code} belum terdaftar. Tambahkan barang dari menu Inventaris.`, 'error') }
  }, [scannerTarget, products, cart, showToast])

  const openAddProduct = () => { setProductDraft({ name: '', sku: '', barcode: '', category: 'Minuman', price: '', cost: '', stock: '', min_stock: '5', unit: 'pcs' }); setModal({ type: 'product' }) }
  const openPriceEdit = (product) => { setPriceDraft({ product_id: product.id, price: String(product.price) }); setModal({ type: 'price', product }) }
  const openProductEdit = (product) => { setProductDraft({ name: product.name || '', sku: product.sku || '', barcode: product.barcode || '', category: product.category || 'Lainnya', image_url: product.image_url || '', price: String(product.price ?? ''), cost: String(product.cost ?? ''), stock: String(product.stock ?? 0), min_stock: String(product.min_stock ?? 5), unit: product.unit || 'pcs' }); setModal({ type: 'product-edit', product }) }
  const openStockEdit = (product) => { setStockDraft({ product_id: product.id, qty_delta: '1', note: '' }); setModal({ type: 'stock', product }) }
  const deleteProduct = async (product) => {
    if (!window.confirm(`Hapus barang “${product.name}”? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      if (demo) setProducts(current => current.filter(p => p.id !== product.id))
      else {
        const { error } = await supabase.from('products').delete().eq('id', product.id).eq('store_id', storeId)
        if (error) throw error
        await loadStoreData(storeId)
      }
      showToast('Barang berhasil dihapus.')
    } catch (err) { showToast(err?.message || 'Barang gagal dihapus. Periksa apakah barang sudah digunakan dalam transaksi.', 'error') }
  }

  const saveProduct = async (e) => {
    e.preventDefault(); setSavingForm(true)
    const draft = { name: productDraft.name.trim(), sku: productDraft.sku.trim(), barcode: productDraft.barcode.trim() || null, category: productDraft.category, image_url: productDraft.image_url.trim() || null, price: Number(productDraft.price), cost: Number(productDraft.cost || 0), stock: Number(productDraft.stock || 0), min_stock: Number(productDraft.min_stock || 0), unit: productDraft.unit || 'pcs', store_id: currentStore.id }
    if (!draft.name || !(draft.price > 0) || draft.stock < 0) { showToast('Periksa nama, harga, dan jumlah stok.', 'error'); setSavingForm(false); return }
    try {
      if (modal?.type === 'product-edit') {
        const { store_id, stock, ...editable } = draft
        const previousStock = Number(modal.product.stock || 0)
        const stockDelta = Number(stock) - previousStock
        if (demo) setProducts(current => current.map(p => p.id === modal.product.id ? { ...p, ...editable, stock: Number(stock), min_stock: Number(draft.min_stock) } : p))
        else {
          const { error } = await supabase.from('products').update({ ...editable, min_stock: Number(draft.min_stock) }).eq('id', modal.product.id).eq('store_id', storeId)
          if (error) throw error
          if (stockDelta !== 0) {
            const { error: stockError } = await supabase.rpc('adjust_stock', { p_store_id: storeId, p_product_id: modal.product.id, p_qty_delta: stockDelta, p_note: 'Perubahan jumlah stok dari edit produk' })
            if (stockError) throw stockError
          }
          await loadStoreData(storeId)
        }
        setModal(null); showToast('Informasi produk berhasil diperbarui.')
        return
      }
      if (demo) {
        setProducts(current => [{ ...draft, id: `prd-new-${Date.now()}`, icon: categoryIcon(draft.category), color: categoryColor(draft.category) }, ...current])
      } else {
        const { data: insertedProduct, error } = await supabase.from('products').insert(draft).select().single()
        if (error) throw error
        await loadStoreData(storeId)
        if (Number(insertedProduct.stock) <= Number(insertedProduct.min_stock ?? 5)) supabase.functions.invoke('notify-low-stock', { body: { store_id: storeId, product_id: insertedProduct.id } }).catch(() => {})
      }
      setModal(null); showToast('Barang berhasil ditambahkan.')
    } catch (err) { showToast(err?.message || 'Gagal menyimpan barang.', 'error') }
    finally { setSavingForm(false) }
  }

  const savePrice = async (e) => {
    e.preventDefault(); setSavingForm(true)
    try {
      const price = Number(priceDraft.price)
      if (!(price > 0)) throw new Error('Harga harus lebih besar dari nol.')
      if (demo) setProducts(current => current.map(p => p.id === priceDraft.product_id ? { ...p, price } : p))
      else {
        const { error } = await supabase.from('products').update({ price }).eq('id', priceDraft.product_id).eq('store_id', storeId)
        if (error) throw error
      }
      if (!demo) await loadStoreData(storeId)
      setModal(null); showToast('Harga barang berhasil diperbarui.')
    } catch (err) { showToast(err.message || 'Gagal memperbarui harga.', 'error') }
    finally { setSavingForm(false) }
  }

  const saveStock = async (e) => {
    e.preventDefault(); setSavingForm(true)
    try {
      const delta = Number(stockDraft.qty_delta)
      if (!Number.isInteger(delta) || delta === 0) throw new Error('Masukkan perubahan stok berupa bilangan bulat, bukan nol.')
      const product = products.find(p => p.id === stockDraft.product_id)
      if (product.stock + delta < 0) throw new Error('Stok tidak boleh menjadi negatif.')
      if (demo) setProducts(current => current.map(p => p.id === stockDraft.product_id ? { ...p, stock: p.stock + delta } : p))
      else {
        const { error } = await supabase.rpc('adjust_stock', { p_store_id: storeId, p_product_id: stockDraft.product_id, p_qty_delta: delta, p_note: stockDraft.note || 'Penyesuaian stok manual' })
        if (error) throw error
        await loadStoreData(storeId)
        if (Number(product.stock) + delta <= Number(product.min_stock ?? 5)) supabase.functions.invoke('notify-low-stock', { body: { store_id: storeId, product_id: product.id } }).catch(() => {})
      }
      setModal(null); showToast('Stok berhasil diperbarui.')
    } catch (err) { showToast(err?.message || 'Penyesuaian stok gagal.', 'error') }
    finally { setSavingForm(false) }
  }

  const saveEmployee = async (e) => {
    e.preventDefault(); setSavingForm(true)
    try {
      if (!employeeDraft.name.trim() || !/^[a-z0-9._-]{3,32}$/.test(employeeDraft.username.trim().toLowerCase()) || employeeDraft.password.length < 8 || !employeeDraft.roles.length) throw new Error('Isi nama, username yang valid, kata sandi minimal 8 karakter, dan pilih peran.')
      if (demo) {
        setEmployees(current => [...current, { id: `emp-${Date.now()}`, name: employeeDraft.name.trim(), username: employeeDraft.username.trim().toLowerCase(), email: '', role: employeeDraft.roles[0], roles: employeeDraft.roles, status: 'active', last_active: null }])
      } else {
        const { data, error } = await supabase.functions.invoke('manage-employee', { body: { action: 'create', store_id: storeId, name: employeeDraft.name.trim(), username: employeeDraft.username.trim().toLowerCase(), password: employeeDraft.password, roles: employeeDraft.roles } })
        if (error) throw error
        await loadStoreData(storeId)
        if (data?.created) showToast(`Akun ${data.username} berhasil dibuat.`)
      }
      setModal(null); showToast(demo ? 'Karyawan demo ditambahkan.' : 'Karyawan berhasil ditambahkan.')
      setEmployeeDraft({ name: '', username: '', password: '', roles: ['cashier'] })
    } catch (err) { showToast(err?.message || 'Gagal menambahkan karyawan.', 'error') }
    finally { setSavingForm(false) }
  }

  const resetEmployeePassword = async (e) => {
    e.preventDefault()
    if (!isStoreOwner || !modal?.employee?.username) return showToast('Hanya pemilik toko yang dapat mengatur ulang password.', 'error')
    if (employeeResetPassword.length < 8) return showToast('Kata sandi harus minimal 8 karakter.', 'error')
    setSavingForm(true)
    try {
      const { error } = await supabase.functions.invoke('manage-employee', { body: { action: 'reset_password', store_id: storeId, username: modal.employee.username, password: employeeResetPassword } })
      if (error) throw error
      setModal(null); setEmployeeResetPassword('')
      showToast('Kata sandi karyawan berhasil diatur ulang.')
    } catch (err) { showToast(err?.message || 'Gagal mengatur ulang kata sandi.', 'error') }
    finally { setSavingForm(false) }
  }

  const saveEmployeeRoles = async (e) => {
    e.preventDefault()
    if (!isStoreOwner || !modal?.employee?.username) return showToast('Hanya pemilik toko yang dapat mengubah peran.', 'error')
    if (!employeeRolesDraft.length) return showToast('Pilih setidaknya satu peran.', 'error')
    setSavingForm(true)
    try {
      if (demo) {
        setEmployees(current => current.map(employee => employee.username === modal.employee.username ? { ...employee, role: employeeRolesDraft[0], roles: employeeRolesDraft } : employee))
      } else {
        const { error } = await supabase.functions.invoke('manage-employee', { body: { action: 'update_roles', store_id: storeId, username: modal.employee.username, roles: employeeRolesDraft } })
        if (error) throw error
        await loadStoreData(storeId)
      }
      setModal(null)
      showToast('Peran karyawan berhasil diperbarui.')
    } catch (err) { showToast(err?.message || 'Gagal mengubah peran karyawan.', 'error') }
    finally { setSavingForm(false) }
  }

  const deleteEmployee = async () => {
    if (!isStoreOwner || !modal?.employee?.username) return showToast('Hanya pemilik toko yang dapat menghapus akun karyawan.', 'error')
    setSavingForm(true)
    try {
      if (demo) {
        setEmployees(current => current.filter(employee => employee.username !== modal.employee.username))
      } else {
        const { error } = await supabase.functions.invoke('manage-employee', { body: { action: 'delete', store_id: storeId, username: modal.employee.username } })
        if (error) throw error
        await loadStoreData(storeId)
      }
      setModal(null)
      showToast('Akun karyawan berhasil dihapus dari toko.')
    } catch (err) { showToast(err?.message || 'Gagal menghapus akun karyawan.', 'error') }
    finally { setSavingForm(false) }
  }

  const createStore = async (e) => {
    e.preventDefault(); setSavingForm(true)
    try {
      if (!storeDraft.name.trim()) throw new Error('Nama toko wajib diisi.')
      if (demo) {
        const newStore = { id: `demo-store-${Date.now()}`, name: storeDraft.name.trim(), city: storeDraft.city.trim(), role: 'owner' }
        setStores(current => [...current, newStore]); setStoreId(newStore.id); setModal(null); showToast('Toko demo baru berhasil dibuat.')
      } else {
        const { data: newStore, error } = await supabase.rpc('create_store', { p_name: storeDraft.name.trim(), p_city: storeDraft.city.trim() })
        if (error) throw error
        const nextStore = { ...newStore, role: 'owner' }
        setStores(current => [...current, nextStore]); setStoreId(newStore.id); setModal(null); showToast('Toko baru berhasil dibuat.')
      }
      setStoreDraft({ name: '', city: '' })
    } catch (err) { showToast(err?.message || 'Gagal membuat toko.', 'error') }
    finally { setSavingForm(false) }
  }

  const exportExcel = (scope = 'daily') => {
    const filteredSales = sales.filter(s => s.status === 'paid' && (scope !== 'daily' || jakartaDateKey(s.created_at) === reportDate))
    const flatItems = filteredSales.flatMap(s => (s.sale_items || []).map(i => ({
      Tanggal: new Date(s.created_at).toLocaleString('id-ID'), 'No. Struk': s.receipt_no, Kasir: s.cashier_name || displayName,
      'Nama Barang': i.product_name || i.name || 'Barang', SKU: products.find(p => p.id === i.product_id)?.sku || '',
      Qty: Number(i.qty || 0), 'Harga Satuan (Rp)': Number(i.unit_price || 0), 'Subtotal (Rp)': Number(i.subtotal ?? ((i.qty || 0) * (i.unit_price || 0))),
      'Metode Bayar': paymentLabel(s.payment_method),
    })))
    const transactionRows = filteredSales.map(s => ({
      Tanggal: new Date(s.created_at).toLocaleString('id-ID'), 'No. Struk': s.receipt_no, Kasir: s.cashier_name || displayName,
      'Jumlah Item': (s.sale_items || []).reduce((sum, i) => sum + Number(i.qty || 0), 0), Subtotal: Number(s.subtotal || s.total || 0),
      Diskon: Number(s.discount || 0), Total: Number(s.total || 0), 'Metode Bayar': paymentLabel(s.payment_method), Status: 'Berhasil',
    }))
    const summaryRows = [
      { Metrik: 'Nama Toko', Nilai: currentStore?.name || 'Toko' },
      { Metrik: 'Tanggal Laporan', Nilai: reportDate },
      { Metrik: 'Total Penjualan', Nilai: filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0) },
      { Metrik: 'Jumlah Transaksi', Nilai: filteredSales.length },
      { Metrik: 'Rata-rata Transaksi', Nilai: filteredSales.length ? Math.round(filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0) / filteredSales.length) : 0 },
      { Metrik: 'Tunai', Nilai: filteredSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + Number(s.total || 0), 0) },
      { Metrik: 'QRIS', Nilai: filteredSales.filter(s => s.payment_method === 'qris').reduce((sum, s) => sum + Number(s.total || 0), 0) },
      { Metrik: 'Transfer', Nilai: filteredSales.filter(s => s.payment_method === 'transfer').reduce((sum, s) => sum + Number(s.total || 0), 0) },
    ]
    const inventoryRows = products.map(p => ({ SKU: p.sku || '', Barcode: p.barcode || '', 'Nama Barang': p.name, Kategori: p.category || '', Stok: Number(p.stock || 0), 'Stok Minimum': Number(p.min_stock || 0), 'Harga Jual (Rp)': Number(p.price || 0), 'Modal (Rp)': Number(p.cost || 0), Satuan: p.unit || 'pcs', Status: Number(p.stock) <= Number(p.min_stock) ? 'Stok menipis' : 'Aman' }))
    const wb = XLSX.utils.book_new()
    const addSheet = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = widths.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name) }
    addSheet(summaryRows, 'Ringkasan', [28, 34]); addSheet(transactionRows, 'Transaksi', [22, 22, 22, 14, 18, 14, 18, 18, 14]); addSheet(flatItems, 'Detail Barang', [22, 22, 22, 30, 14, 9, 18, 18, 18]); addSheet(inventoryRows, 'Inventaris', [15, 18, 30, 18, 12, 15, 18, 18, 12, 18])
    wb.Props = { Title: `Laporan ${currentStore?.name || 'Toko'}`, Subject: 'Laporan POS TokoFlow', Author: 'TokoFlow POS', CreatedDate: new Date() }
    XLSX.writeFile(wb, `TokoFlow-${(currentStore?.name || 'Toko').replace(/[^a-z0-9]/gi, '-')}-${reportDate}.xlsx`)
    showToast('File Excel berhasil diunduh.')
  }

  const printReceipt = (sale) => {
    if (!sale) return
    const items = sale.sale_items || []
    const content = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Struk ${sale.receipt_no}</title><style>
      *{box-sizing:border-box}body{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;width:280px;margin:0 auto;padding:12px}h1{font:700 18px Arial;text-align:center;margin:0}p{margin:3px 0;text-align:center}.line{border-top:1px dashed #999;margin:10px 0}.row{display:flex;justify-content:space-between;gap:10px}.item{margin:8px 0}.item small{display:block;color:#555}.total{font-size:15px;font-weight:bold}.muted{color:#666;font-size:11px}@media print{body{width:auto;padding:0}@page{margin:5mm}}
      </style></head><body><h1>${escapeHtml(currentStore?.name || 'TokoFlow POS')}</h1><p>${escapeHtml(currentStore?.city || '')}</p><div class="line"></div><div class="row"><span>Struk</span><span>${escapeHtml(sale.receipt_no || '-')}</span></div><div class="row"><span>Waktu</span><span>${new Date(sale.created_at).toLocaleString('id-ID')}</span></div><div class="row"><span>Kasir</span><span>${escapeHtml(sale.cashier_name || displayName)}</span></div><div class="line"></div>${items.map(i=>`<div class="item"><div>${escapeHtml(i.product_name || i.name || 'Barang')}</div><div class="row"><small>${i.qty} x ${money(i.unit_price)}</small><span>${money(i.subtotal ?? i.qty*i.unit_price)}</span></div></div>`).join('')}<div class="line"></div><div class="row"><span>Subtotal</span><span>${money(sale.subtotal || sale.total)}</span></div><div class="row"><span>Diskon</span><span>-${money(sale.discount || 0)}</span></div><div class="row total"><span>TOTAL</span><span>${money(sale.total)}</span></div><div class="row"><span>Bayar</span><span>${paymentLabel(sale.payment_method)}</span></div><div class="line"></div><p>Terima kasih sudah berbelanja!</p><p class="muted">Powered by TokoFlow POS</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`
    const win = window.open('', '_blank', 'width=360,height=720')
    if (!win) { showToast('Izinkan pop-up untuk mencetak struk.', 'error'); return }
    win.document.open(); win.document.write(content); win.document.close()
  }

  const enablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return showToast('Browser ini belum mendukung notifikasi.', 'error')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return showToast('Izin notifikasi belum diberikan.', 'error')
    if (demo) { new Notification('TokoFlow POS', { body: 'Notifikasi demo berhasil diaktifkan.' }); showToast('Notifikasi perangkat diaktifkan untuk sesi ini.'); return }
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapid) return showToast('Tambahkan VITE_VAPID_PUBLIC_KEY untuk mengaktifkan push di latar belakang.', 'error')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) })
      const json = subscription.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({ user_id: session.user.id, store_id: storeId || null, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
      if (error) throw error
      showToast('Push notification berhasil diaktifkan.')
    } catch (err) { showToast(err?.message || 'Gagal mengaktifkan push notification.', 'error') }
  }

  const openPrinter = async () => {
    if (!navigator.bluetooth) return showToast('Web Bluetooth tidak tersedia di browser ini. Coba Chrome Android atau gunakan tombol Cetak struk.', 'error')
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb'] })
      showToast(`Printer ${device.name || 'Bluetooth'} terdeteksi. Kompatibilitas cetak bergantung pada profil BLE printer.`, 'info')
      // A printer picker is intentionally not treated as proof of printing support.
    } catch (err) { if (err?.name !== 'NotFoundError') showToast(err?.message || 'Gagal menghubungkan printer.', 'error') }
  }

  const selectedReportSales = sales.filter(s => s.status === 'paid' && jakartaDateKey(s.created_at) === reportDate)
  const todaySales = sales.filter(s => s.status === 'paid' && jakartaDateKey(s.created_at) === todayISO())
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  const lowStockProducts = products.filter(p => Number(p.stock) <= Number(p.min_stock ?? 5))
  const topProducts = useMemo(() => {
    const map = new Map()
    sales.filter(s => s.status === 'paid').forEach(s => (s.sale_items || []).forEach(i => { const key = i.product_id || i.product_name || i.name; const current = map.get(key) || { name: i.product_name || i.name || 'Barang', qty: 0, revenue: 0 }; current.qty += Number(i.qty || 0); current.revenue += Number(i.subtotal ?? Number(i.qty || 0) * Number(i.unit_price || 0)); map.set(key, current) }))
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 4)
  }, [sales])

  const switchStore = (id) => { setStoreId(id); setCart([]); setProducts([]); setSales([]); setEmployees([]); showToast(`Beralih ke ${stores.find(s => s.id === id)?.name || 'toko'}.`) }

  const renderDashboard = () => <>
    <PageTitle eyebrow="RINGKASAN BISNIS" title={`Selamat ${new Date().getHours() < 11 ? 'pagi' : new Date().getHours() < 15 ? 'siang' : new Date().getHours() < 19 ? 'sore' : 'malam'}, ${displayName.split(' ')[0]}`} description="Pantau performa toko Anda hari ini." actions={<button className="button button-secondary" onClick={() => { setReportDate(todayISO()); navigate('reports') }}><CalendarDays size={16} /> Laporan hari ini</button>} />
    <div className="kpi-grid">
      <KPI icon={Wallet} label="Penjualan hari ini" value={idr(todayRevenue)} trend={demo ? '12,8%' : undefined} trendLabel={demo ? 'vs. hari sebelumnya' : `${todaySales.length} transaksi berhasil`} tone="green" />
      <KPI icon={ShoppingBag} label="Total transaksi" value={todaySales.length.toLocaleString('id-ID')} trend={demo ? '8,2%' : undefined} trendLabel={demo ? 'vs. hari sebelumnya' : 'transaksi hari ini'} tone="blue" />
      <KPI icon={Package} label="Produk terdaftar" value={products.length.toLocaleString('id-ID')} trendLabel={`${products.reduce((a, p) => a + Number(p.stock || 0), 0).toLocaleString('id-ID')} total unit stok`} tone="purple" />
      <KPI icon={AlertTriangle} label="Stok menipis" value={lowStockProducts.length.toLocaleString('id-ID')} trendLabel="Perlu restock segera" tone="amber" trendDown />
    </div>
    <div className="dashboard-grid dashboard-grid-primary">
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Tren penjualan</h3><p>Performa tujuh hari terakhir</p></div><div className="chart-legend"><span /> Penjualan</div></div><SalesChart sales={sales} /><div className="chart-summary"><div><span>Total penjualan hari ini</span><strong>{idr(todayRevenue)}</strong></div><div className="chart-summary-divider" /><div><span>Rata-rata transaksi</span><strong>{idr(todaySales.length ? todayRevenue / todaySales.length : 0)}</strong></div></div></section>
      <section className="panel payment-panel"><div className="panel-heading"><div><h3>Metode pembayaran</h3><p>Komposisi transaksi hari ini</p></div><button className="text-action" onClick={() => navigate('reports')}>Detail <ArrowRight size={14} /></button></div>
        {todaySales.length ? <><div className="payment-donut-wrap"><div className="payment-donut"><div><strong>{todaySales.length}</strong><small>transaksi</small></div></div><div className="payment-legend">{['cash', 'qris', 'transfer'].map((method, i) => { const count = todaySales.filter(s => s.payment_method === method).length; return <div key={method}><span className={`legend-dot legend-${method}`} /><span>{paymentLabel(method)}</span><strong>{Math.round(count / todaySales.length * 100)}%</strong></div> })}</div></div><div className="payment-panel-total"><span>Omzet hari ini</span><strong>{idr(todayRevenue)}</strong></div></> : <EmptyState icon={CreditCard} title="Belum ada transaksi" text="Transaksi yang tercatat hari ini akan muncul di sini." action={<button className="text-action" onClick={() => navigate('cashier')}>Buka kasir <ArrowRight size={14} /></button>} />}
      </section>
    </div>
    <div className="dashboard-grid dashboard-grid-secondary">
      <section className="panel"><div className="panel-heading"><div><h3>Transaksi terbaru</h3><p>Aktivitas penjualan terkini</p></div><button className="text-action" onClick={() => navigate('transactions')}>Lihat semua <ArrowRight size={14} /></button></div>
        <div className="transaction-list">{sales.slice(0, 4).map(s => <button key={s.id} className="transaction-row" onClick={() => { setReceiptToShow(s); setModal({ type: 'receipt', sale: s }) }}><span className={`transaction-method-icon ${s.payment_method}`}><ReceiptText size={17} /></span><span className="transaction-main"><strong>{s.receipt_no}</strong><small>{s.cashier_name || displayName} · {formatDate(s.created_at)}</small></span><span className="transaction-amount"><strong>{idr(s.total)}</strong><small>{paymentLabel(s.payment_method)}</small></span><ChevronRight className="transaction-chevron" size={16} /></button>)}</div>
        {sales.length === 0 && <EmptyState icon={ReceiptText} title="Belum ada transaksi" text="Transaksi yang dibuat kasir akan tampil di sini." />}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Perlu restock</h3><p>Produk di bawah batas minimum</p></div><button className="text-action" onClick={() => navigate('inventory')}>Kelola stok <ArrowRight size={14} /></button></div>
        {lowStockProducts.length ? <div className="restock-list">{lowStockProducts.slice(0, 4).map(p => <div className="restock-row" key={p.id}><ProductVisual product={p} /><span className="restock-main"><strong>{p.name}</strong><small>Min. stok {p.min_stock} {p.unit || 'unit'}</small></span><span className="stock-warning"><strong>{p.stock}</strong><small>{p.unit || 'unit'}</small></span><IconButton icon={Plus} label={`Tambah stok ${p.name}`} onClick={() => openStockEdit(p)} /></div>)}</div> : <EmptyState icon={CheckCircle2} title="Stok aman" text="Semua barang berada di atas batas stok minimum." />}
      </section>
    </div>
  </>

  const renderCashier = () => {
    if (!canUseCashier) return <EmptyState icon={LockKeyhole} title="Akses kasir dibatasi" text="Akun Anda tidak memiliki peran Kasir. Hubungi pemilik toko jika akses transaksi memang diperlukan." action={<button className="button button-secondary" onClick={() => navigate('dashboard')}>Kembali ke ringkasan</button>} />
    const query = cartSearch.trim().toLowerCase()
    const productsForSale = products.filter(p => (cartCategory === 'Semua' || p.category === cartCategory) && (!query || [p.name, p.sku, p.barcode].some(x => String(x || '').toLowerCase().includes(query))))
    return <div className="cashier-layout">
      <section className="cashier-catalog">
        <div className="cashier-header"><div><div className="eyebrow">MODE KASIR</div><h1>Transaksi baru</h1><p>Pilih barang atau scan barcode untuk memulai.</p></div><div className="cashier-status"><span className="live-dot" /> Kasir aktif</div></div>
        <div className="cashier-search-row"><div className="search-input cashier-search"><Search size={18} /><input value={cartSearch} onChange={e => setCartSearch(e.target.value)} placeholder="Cari nama, SKU, atau barcode…" /><button type="button" aria-label="Scan barcode" onClick={() => showScanner('cashier')}><ScanLine size={18} /></button></div><button className="button button-secondary scan-action" onClick={() => showScanner('cashier')}><Camera size={17} /> Scan</button></div>
        <div className="category-chips">{categories.map(cat => <button key={cat} onClick={() => setCartCategory(cat)} className={cartCategory === cat ? 'active' : ''}>{cat}</button>)}</div>
        <div className="cashier-product-grid">{productsForSale.map(p => <button key={p.id} className="cashier-product-card" onClick={() => addToCart(p)} disabled={p.stock <= 0}><div className="cashier-product-top"><ProductVisual product={p} large />{p.stock <= p.min_stock && <span className="mini-low-stock">Stok {p.stock}</span>}</div><span className="cashier-product-name">{p.name}</span><span className="cashier-product-meta">{p.sku || 'Tanpa SKU'}</span><span className="cashier-product-bottom"><strong>{idr(p.price)}</strong><i><Plus size={15} /></i></span></button>)}</div>
        {!productsForSale.length && <EmptyState icon={Search} title="Barang tidak ditemukan" text="Coba kata kunci lain atau tambahkan barang melalui menu inventaris." action={<button className="button button-secondary button-sm" onClick={() => navigate('inventory')}>Buka inventaris</button>} />}
      </section>
      <aside className="cart-panel"><div className="cart-heading"><div><h2><ShoppingCart size={19} /> Keranjang</h2><p>{cart.reduce((a, i) => a + i.qty, 0)} item dipilih</p></div><button className="text-action" disabled={!cart.length} onClick={() => { setCart([]); setCartDiscount('0'); setCashReceived('') }}>Kosongkan</button></div>
        <div className="cart-items">{cart.map(({ product, qty }) => <div className="cart-item" key={product.id}><ProductVisual product={product} /><div className="cart-item-details"><strong>{product.name}</strong><small>{idr(product.price)} / {product.unit || 'unit'}</small><div className="qty-control"><button onClick={() => changeCartQty(product.id, qty - 1)} aria-label="Kurangi jumlah"><Minus size={13} /></button><span>{qty}</span><button onClick={() => changeCartQty(product.id, qty + 1)} aria-label="Tambah jumlah"><Plus size={13} /></button></div></div><div className="cart-item-price"><strong>{idr(product.price * qty)}</strong><button onClick={() => changeCartQty(product.id, 0)} aria-label={`Hapus ${product.name}`}><Trash2 size={14} /></button></div></div>)}{!cart.length && <div className="cart-empty"><div><ShoppingCart size={24} /></div><strong>Keranjang masih kosong</strong><p>Pilih barang dari daftar untuk memulai transaksi.</p></div>}</div>
        <div className="cart-bottom"><div className="discount-row"><span>Diskon transaksi</span><div className="discount-input"><span>Rp</span><input inputMode="numeric" value={cartDiscount} onChange={e => setCartDiscount(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Diskon rupiah" /></div></div><div className="cart-summary-row"><span>Subtotal</span><strong>{idr(cartSubtotal)}</strong></div><div className="cart-summary-row"><span>Diskon</span><strong className="discount-text">−{idr(discountAmount)}</strong></div><div className="cart-total-row"><span>Total bayar</span><strong>{idr(cartTotal)}</strong></div>
          <div className="payment-selector-label">Pilih metode pembayaran</div><div className="checkout-methods"><button className={paymentMethod === 'cash' ? 'selected' : ''} onClick={() => setPaymentMethod('cash')}><Banknote size={17} /><span>Tunai</span></button><button className={paymentMethod === 'qris' ? 'selected' : ''} onClick={() => setPaymentMethod('qris')}><QrCode size={17} /><span>QRIS</span></button><button className={paymentMethod === 'transfer' ? 'selected' : ''} onClick={() => setPaymentMethod('transfer')}><CreditCard size={17} /><span>Transfer</span></button></div>
          {paymentMethod === 'qris' && !demo && qrisSavedSettings?.mode === 'both' && <div className="qris-mode-choice"><label><input type="radio" name="qris-mode" checked={qrisCheckoutMode === 'static'} onChange={() => setQrisCheckoutMode('static')} /> QRIS statis <small>Konfirmasi manual</small></label><label><input type="radio" name="qris-mode" checked={qrisCheckoutMode === 'dynamic'} onChange={() => setQrisCheckoutMode('dynamic')} /> QRIS dinamis <small>Konfirmasi otomatis</small></label></div>}
          {paymentMethod === 'cash' && cart.length > 0 && <div className="cash-received"><label>Uang diterima</label><div className="discount-input"><span>Rp</span><input inputMode="numeric" value={cashReceived} onChange={e => setCashReceived(e.target.value.replace(/[^0-9]/g, ''))} placeholder={String(cartTotal)} /></div><small>Kembalian <strong>{idr(Math.max(0, Number(cashReceived || 0) - cartTotal))}</strong></small></div>}
          <button className="button button-primary button-wide checkout-button" disabled={!cart.length || checkoutBusy || (paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < cartTotal)} onClick={checkout}>{checkoutBusy ? <span className="spinner" /> : paymentMethod === 'qris' ? <QrCode size={18} /> : <CheckCircle2 size={18} />}{paymentMethod === 'qris' ? 'Lanjut ke pembayaran QRIS' : 'Selesaikan transaksi'} <ArrowRight size={17} /></button>
          <div className="secure-caption"><LockKeyhole size={12} /> Stok diperbarui saat transaksi disimpan</div>
        </div>
      </aside>
    </div>
  }

  const renderInventory = () => <>
    <PageTitle eyebrow="MANAJEMEN BARANG" title="Inventaris" description="Pantau stok, harga jual, dan kode barcode barang." actions={<><button className="button button-secondary" onClick={() => showScanner('inventory')}><ScanLine size={17} /> Scan barcode</button><button className="button button-primary" onClick={openAddProduct}><Plus size={17} /> Tambah barang</button></>} />
    <div className="inventory-stat-row"><div className="inventory-stat"><span className="inventory-stat-icon green"><Boxes size={19} /></span><div><small>Total jenis barang</small><strong>{products.length}</strong></div></div><div className="inventory-stat"><span className="inventory-stat-icon blue"><Package size={19} /></span><div><small>Total unit stok</small><strong>{products.reduce((a, p) => a + Number(p.stock || 0), 0).toLocaleString('id-ID')}</strong></div></div><div className="inventory-stat"><span className="inventory-stat-icon amber"><AlertTriangle size={19} /></span><div><small>Stok menipis</small><strong>{lowStockProducts.length}</strong></div></div><div className="inventory-stat"><span className="inventory-stat-icon purple"><CircleDollarSign size={19} /></span><div><small>Nilai stok (harga modal)</small><strong>{idr(products.reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0))}</strong></div></div></div>
    <section className="panel inventory-panel"><div className="inventory-toolbar"><div className="search-input inventory-search"><Search size={17} /><input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Cari nama barang, SKU, barcode…" />{stockSearch && <button onClick={() => setStockSearch('')} aria-label="Hapus pencarian"><X size={14} /></button>}</div><div className="toolbar-right"><select value={stockCategory} onChange={e => setStockCategory(e.target.value)} aria-label="Filter kategori">{categories.map(cat => <option key={cat}>{cat}</option>)}</select><span className="result-count">{filteredProducts.length} barang</span></div></div>
      <div className="inventory-table-wrap"><table className="data-table inventory-table"><thead><tr><th>Nama barang</th><th>SKU / Barcode</th><th>Kategori</th><th>Harga jual</th><th>Stok saat ini</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{filteredProducts.map(p => <tr key={p.id}><td><div className="table-product"><ProductVisual product={p} /><div><strong>{p.name}</strong><small>Modal {idr(p.cost || 0)}</small></div></div></td><td><strong className="mono-text">{p.sku || '—'}</strong><small className="table-subtext">{p.barcode || 'Tanpa barcode'}</small></td><td><span className="category-label">{p.category || 'Lainnya'}</span></td><td><strong>{idr(p.price)}</strong><button className="inline-edit" onClick={() => openPriceEdit(p)}><Pencil size={11} /> Ubah harga</button><button className="inline-edit" onClick={() => openProductEdit(p)}><Pencil size={11} /> Edit produk</button></td><td><div className="stock-level"><strong className={p.stock <= p.min_stock ? 'danger-text' : ''}>{p.stock}</strong><span>{p.unit || 'unit'}</span></div><small className="table-subtext">Min. {p.min_stock ?? 5}</small></td><td>{p.stock <= 0 ? <StatusPill status="cancelled" /> : p.stock <= p.min_stock ? <span className="stock-pill warning"><i /> Menipis</span> : <span className="stock-pill okay"><i /> Aman</span>}</td><td><div className="table-actions"><button className="button button-outline button-xs" onClick={() => openStockEdit(p)}><PackagePlus size={14} /> Stok</button><button className="icon-button tiny" aria-label={`Edit produk ${p.name}`} onClick={() => openProductEdit(p)}><Pencil size={16} /></button><button className="icon-button tiny danger-action" aria-label={`Hapus ${p.name}`} onClick={() => deleteProduct(p)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
      <div className="mobile-product-list">{filteredProducts.map(p => <div className="mobile-inventory-card" key={p.id}><div className="mobile-inventory-top"><ProductVisual product={p} large /><div className="mobile-inventory-name"><strong>{p.name}</strong><small>{p.sku || 'Tanpa SKU'} · {p.category || 'Lainnya'}</small><span>{p.barcode || 'Barcode belum diatur'}</span></div><button className="icon-button tiny" onClick={() => openProductEdit(p)} aria-label={`Edit produk ${p.name}`}><Pencil size={16} /></button></div><div className="mobile-inventory-bottom"><span><small>Harga jual</small><strong>{idr(p.price)}</strong></span><span><small>Stok tersedia</small><strong className={p.stock <= p.min_stock ? 'danger-text' : ''}>{p.stock} {p.unit || 'unit'}</strong></span><button className="button button-outline button-sm" onClick={() => openStockEdit(p)}><PackagePlus size={14} /> Update stok</button><button className="button button-outline button-sm" onClick={() => openProductEdit(p)}><Pencil size={14} /> Edit</button><button className="button button-outline button-sm" onClick={() => deleteProduct(p)}><Trash2 size={14} /> Hapus</button></div></div>)}</div>
      {!filteredProducts.length && <EmptyState icon={Package} title="Barang tidak ditemukan" text="Ubah filter atau tambahkan barang baru." action={<button className="button button-primary button-sm" onClick={openAddProduct}><Plus size={15} /> Tambah barang</button>} />}
      <div className="table-footer"><span>Stok disinkronkan otomatis untuk anggota toko dengan akses yang sesuai.</span><span><span className="live-dot" /> Sinkronisasi aktif</span></div>
    </section>
  </>

  const renderTransactions = () => <>
    <PageTitle eyebrow="RIWAYAT PENJUALAN" title="Transaksi" description="Lihat dan telusuri seluruh transaksi toko." actions={<button className="button button-secondary" onClick={() => { setReportDate(todayISO()); exportExcel('daily') }}><Download size={16} /> Ekspor Excel hari ini</button>} />
    <section className="panel transactions-panel"><div className="panel-heading"><div><h3>Semua transaksi</h3><p>{sales.length} transaksi tercatat di toko ini</p></div><div className="transaction-filter-info"><span className="live-dot" /> Data terbaru</div></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>No. struk</th><th>Tanggal & waktu</th><th>Kasir</th><th>Item</th><th>Pembayaran</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{sales.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(s => <tr key={s.id}><td><button className="receipt-link" onClick={() => setModal({ type: 'receipt', sale: s })}>{s.receipt_no}</button></td><td>{formatDate(s.created_at, { year: 'numeric' })}</td><td>{s.cashier_name || displayName}</td><td>{(s.sale_items || []).reduce((n, item) => n + Number(item.qty || 0), 0)} item</td><td><span className={`payment-type ${s.payment_method}`}><i />{paymentLabel(s.payment_method)}</span></td><td><strong>{idr(s.total)}</strong></td><td><StatusPill status={s.status} /></td><td><button className="icon-button tiny" aria-label="Lihat struk" onClick={() => setModal({ type: 'receipt', sale: s })}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>
      {!sales.length && <EmptyState icon={ReceiptText} title="Belum ada transaksi" text="Transaksi yang berhasil di kasir akan muncul di halaman ini." action={<button className="button button-primary button-sm" onClick={() => navigate('cashier')}>Buka kasir</button>} />}
      <div className="table-footer"><span>Transaksi yang menunggu pembayaran QRIS tidak dihitung sebagai penjualan berhasil.</span><button className="text-action" onClick={() => navigate('reports')}>Lihat laporan <ArrowRight size={14} /></button></div>
    </section>
  </>

  const renderReports = () => {
    const gross = selectedReportSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
    const itemsSold = selectedReportSales.reduce((sum, s) => sum + (s.sale_items || []).reduce((a, i) => a + Number(i.qty || 0), 0), 0)
    const paymentCounts = ['cash', 'qris', 'transfer'].map(method => ({ method, count: selectedReportSales.filter(s => s.payment_method === method).length, total: selectedReportSales.filter(s => s.payment_method === method).reduce((sum, s) => sum + Number(s.total || 0), 0) }))
    return <>
      <PageTitle eyebrow="ANALISIS BISNIS" title="Laporan penjualan" description="Ringkasan harian yang dapat diunduh dalam format Excel." actions={<button className="button button-primary" onClick={() => exportExcel('daily')}><FileSpreadsheet size={17} /> Download Excel</button>} />
      <section className="report-filter-bar"><div className="report-filter-label"><span className="report-filter-icon"><CalendarDays size={18} /></span><span><strong>Periode laporan</strong><small>Pilih tanggal rekap penjualan</small></span></div><div className="report-filter-controls"><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} max={todayISO()} aria-label="Tanggal laporan" /><button className="button button-secondary button-sm" onClick={() => setReportDate(todayISO())}>Hari ini</button><button className="button button-primary button-sm" onClick={() => exportExcel('daily')}><Download size={15} /> Ekspor</button></div></section>
      <div className="report-summary-cards"><div className="report-summary-card featured"><span>Total penjualan bersih</span><strong>{idr(gross)}</strong><small><TrendingUp size={14} /> {selectedReportSales.length} transaksi berhasil</small><div className="summary-card-watermark"><Wallet size={64} /></div></div><div className="report-summary-card"><span>Total transaksi</span><strong>{selectedReportSales.length}</strong><small><ReceiptText size={14} /> Struk berhasil</small><span className="report-summary-icon"><ShoppingBag size={20} /></span></div><div className="report-summary-card"><span>Total barang terjual</span><strong>{itemsSold}</strong><small><Boxes size={14} /> Unit barang</small><span className="report-summary-icon"><Package size={20} /></span></div><div className="report-summary-card"><span>Rata-rata transaksi</span><strong>{idr(selectedReportSales.length ? gross / selectedReportSales.length : 0)}</strong><small><Activity size={14} /> Nilai per struk</small><span className="report-summary-icon"><BarChart3 size={20} /></span></div></div>
      <div className="dashboard-grid report-grid"><section className="panel"><div className="panel-heading"><div><h3>Rincian metode pembayaran</h3><p>{new Date(`${reportDate}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div><div className="payment-breakdown">{paymentCounts.map(item => <div className="payment-breakdown-row" key={item.method}><span className={`breakdown-icon ${item.method}`}>{item.method === 'cash' ? <Banknote size={18} /> : item.method === 'qris' ? <QrCode size={18} /> : <CreditCard size={18} />}</span><span className="breakdown-main"><strong>{paymentLabel(item.method)}</strong><small>{item.count} transaksi</small></span><span className="breakdown-money"><strong>{idr(item.total)}</strong><span className="breakdown-bar"><i style={{ width: `${gross ? item.total / gross * 100 : 0}%` }} /></span></span></div>)}</div><div className="report-total-row"><span>Total penjualan</span><strong>{idr(gross)}</strong></div></section>
        <section className="panel top-products-panel"><div className="panel-heading"><div><h3>Produk terlaris</h3><p>Berdasarkan jumlah unit terjual</p></div><span className="panel-icon-bubble"><TrendingUp size={17} /></span></div>{topProducts.map((p, idx) => <div className="top-product-row" key={p.name}><span className={`top-rank rank-${idx + 1}`}>{String(idx + 1).padStart(2, '0')}</span><div className="top-product-main"><strong>{p.name}</strong><div className="top-product-track"><i style={{ width: `${topProducts[0]?.qty ? p.qty / topProducts[0].qty * 100 : 0}%` }} /></div></div><div className="top-product-values"><strong>{p.qty} unit</strong><small>{idr(p.revenue)}</small></div></div>)}{!topProducts.length && <EmptyState icon={TrendingUp} title="Belum ada data" text="Produk terlaris muncul setelah ada transaksi." />}</section></div>
      <section className="panel report-transactions-panel"><div className="panel-heading"><div><h3>Transaksi dalam periode</h3><p>Data yang ikut dimasukkan ke laporan Excel</p></div><button className="text-action" onClick={() => navigate('transactions')}>Riwayat lengkap <ArrowRight size={14} /></button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>No. struk</th><th>Waktu</th><th>Kasir</th><th>Item</th><th>Metode bayar</th><th>Total</th></tr></thead><tbody>{selectedReportSales.map(s => <tr key={s.id}><td><button className="receipt-link" onClick={() => setModal({ type: 'receipt', sale: s })}>{s.receipt_no}</button></td><td>{formatDate(s.created_at)}</td><td>{s.cashier_name || displayName}</td><td>{(s.sale_items || []).reduce((n,i)=>n+Number(i.qty||0),0)}</td><td>{paymentLabel(s.payment_method)}</td><td><strong>{idr(s.total)}</strong></td></tr>)}</tbody></table></div>{!selectedReportSales.length && <EmptyState icon={FileSpreadsheet} title="Tidak ada penjualan pada tanggal ini" text="Pilih tanggal lain untuk melihat laporan atau lakukan transaksi di kasir." />}</section>
      <div className="report-export-note"><FileSpreadsheet size={18} /><div><strong>Ekspor laporan multi-sheet</strong><p>File Excel memuat ringkasan, transaksi, detail barang per transaksi, dan inventaris toko. Laporan hanya mencakup data dari toko yang sedang dipilih.</p></div><button className="button button-secondary" onClick={() => exportExcel('daily')}><Download size={16} /> Unduh .xlsx</button></div>
    </>
  }

  const renderEmployees = () => <>
    <PageTitle eyebrow="TIM & PERIZINAN" title="Manajemen karyawan" description="Atur siapa yang dapat mengakses kasir, stok, dan laporan." actions={isStoreOwner && <button className="button button-primary" onClick={() => { setEmployeeDraft({ name: '', username: '', password: '', roles: ['cashier'] }); setModal({ type: 'employee' }) }}><Plus size={17} /> Tambah karyawan</button>} />
    <div className="employee-role-cards"><div><span className="role-card-icon owner"><ShieldCheck size={19} /></span><section><strong>Pemilik</strong><small>Akses penuh dan pengaturan toko</small></section><b>{employees.filter(e => e.role === 'owner').length || (currentRole === 'owner' ? 1 : 0)}</b></div><div><span className="role-card-icon manager"><SlidersHorizontal size={19} /></span><section><strong>Manajer</strong><small>Transaksi, stok, dan laporan</small></section><b>{employees.filter(e => e.role === 'manager').length}</b></div><div><span className="role-card-icon cashier"><ShoppingCart size={19} /></span><section><strong>Kasir</strong><small>Transaksi dan struk penjualan</small></section><b>{employees.filter(e => e.role === 'cashier').length}</b></div><div><span className="role-card-icon inventory"><Package size={19} /></span><section><strong>Inventaris</strong><small>Barang, harga, dan stok</small></section><b>{employees.filter(e => e.role === 'inventory').length}</b></div></div>
    <section className="panel employee-panel"><div className="panel-heading"><div><h3>Anggota tim</h3><p>{employees.length + (currentRole === 'owner' && !employees.some(e => e.role === 'owner') ? 1 : 0)} anggota terdaftar di {currentStore?.name}</p></div><span className="access-control-label"><LockKeyhole size={14} /> Akses berbasis peran</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nama karyawan</th><th>Username</th><th>Peran akses</th><th>Status</th><th>Aktivitas terakhir</th><th /></tr></thead><tbody>{(currentRole === 'owner' && !employees.some(e => e.role === 'owner') ? [{ id: 'owner-self', name: displayName, email: session?.user?.email || 'Akun pemilik', role: 'owner', status: 'active', last_active: new Date().toISOString() }, ...employees] : employees).map((employee, index) => <tr key={employee.id || employee.user_id || index}><td><div className="employee-name-cell"><span className={`avatar avatar-${employee.role}`}>{initials(employee.name)}</span><div><strong>{employee.name}</strong>{employee.role === 'owner' && <small>Pemilik akun</small>}</div></div></td><td>{employee.username || employee.email || '—'}</td><td><span className={`role-pill ${employee.role}`}>{(employee.roles || [employee.role]).map(roleLabel).join(' + ')}</span></td><td><StatusPill status={employee.status || 'active'} /></td><td>{employee.last_active ? formatDate(employee.last_active, { year: 'numeric' }) : 'Belum aktif'}</td><td>{isStoreOwner && employee.username && <div className="employee-row-actions"><button className="icon-button tiny" aria-label={`Ubah peran ${employee.name}`} title="Ubah peran" onClick={() => { setEmployeeRolesDraft(employee.roles || [employee.role].filter(role => role !== 'owner')); setModal({ type: 'employee-roles', employee }) }}><Pencil size={16} /></button><button className="icon-button tiny" aria-label={`Atur ulang kata sandi ${employee.name}`} title="Atur ulang kata sandi" onClick={() => { setEmployeeResetPassword(''); setModal({ type: 'employee-reset', employee }) }}><KeyRound size={17} /></button><button className="icon-button tiny" aria-label={`Hapus akun ${employee.name}`} title="Hapus akun karyawan" onClick={() => setModal({ type: 'employee-delete', employee })}><Trash2 size={16} /></button></div>}</td></tr>)}</tbody></table></div>{!employees.length && currentRole !== 'owner' && <EmptyState icon={Users} title="Belum ada anggota" text="Tambahkan karyawan untuk memberi akses berdasarkan peran." action={<button className="button button-primary button-sm" onClick={() => setModal({ type: 'employee' })}><Plus size={15} /> Tambah karyawan</button>} />}
      <div className="role-permission-note"><ShieldCheck size={18} /><div><strong>Setiap peran memiliki batas akses berbeda</strong><p>Kasir hanya memproses transaksi; inventaris mengelola barang dan stok; manajer mengakses laporan dan tim; pemilik mengatur seluruh toko. Data antartoko tetap dipisahkan oleh kebijakan database.</p></div></div></section>
  </>

  const saveQrisSettings = async () => {
    if (demo || !supabase || !currentStore?.id) return showToast('Pengaturan QRIS membutuhkan koneksi Supabase.', 'error')
    setQrisSettingsBusy(true)
    try {
      let staticPath = qrisSavedSettings?.static_qr_storage_path || null
      if (qrisStaticFile) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(qrisStaticFile.type)) throw new Error('Gunakan gambar PNG, JPG, atau WebP.')
        if (qrisStaticFile.size > 5 * 1024 * 1024) throw new Error('Ukuran gambar QRIS maksimal 5 MB.')
        const safeName = qrisStaticFile.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
        staticPath = `${currentStore.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('store-qris').upload(staticPath, qrisStaticFile, { contentType: qrisStaticFile.type, upsert: false })
        if (uploadError) throw uploadError
      }
      const { data, error } = await supabase.functions.invoke('save-qris-settings', { body: {
        store_id: currentStore.id, mode: qrisSettingsDraft.mode,
        merchant_display_name: qrisSettingsDraft.merchant_display_name,
        provider_merchant_id: qrisSettingsDraft.provider_merchant_id,
        provider_server_key: qrisSettingsDraft.provider_server_key,
        provider_is_production: qrisSettingsDraft.provider_is_production,
        static_qr_storage_path: staticPath,
      } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setQrisSavedSettings({ ...(qrisSavedSettings || {}), mode: qrisSettingsDraft.mode, static_qr_storage_path: staticPath, merchant_display_name: qrisSettingsDraft.merchant_display_name, provider_merchant_id: qrisSettingsDraft.provider_merchant_id, provider_is_production: qrisSettingsDraft.provider_is_production, dynamic_status: data.dynamic_status })
      setQrisSettingsDraft(current => ({ ...current, provider_server_key: '' }))
      setQrisStaticFile(null)
      showToast('Pengaturan QRIS toko berhasil disimpan.')
    } catch (err) { showToast(err?.message || 'Pengaturan QRIS gagal disimpan.', 'error') }
    finally { setQrisSettingsBusy(false) }
  }

  const confirmStaticQris = async () => {
    if (!supabase || !modal?.sale_id) return
    try {
      const { data, error } = await supabase.functions.invoke('confirm-static-qris-payment', { body: { sale_id: modal.sale_id } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const { data: saleData, error: saleError } = await supabase.from('sales').select('*,sale_items(*)').eq('id', modal.sale_id).single()
      if (saleError) throw saleError
      await loadStoreData(storeId)
      setCart([]); setCartDiscount('0'); setCashReceived('')
      setModal({ type: 'receipt', sale: normaliseSale(saleData) })
      showToast('Pembayaran QRIS statis dikonfirmasi. Pastikan pembayaran sudah dicek di portal merchant.')
    } catch (err) { showToast(err?.message || 'Konfirmasi pembayaran gagal.', 'error') }
  }

  const renderSettings = () => <>
    <PageTitle eyebrow="KONFIGURASI" title="Pengaturan toko" description="Kelola informasi toko, perangkat, dan integrasi yang digunakan." />
    <div className="settings-grid"><section className="panel settings-section"><div className="settings-section-heading"><span className="settings-icon"><Store size={19} /></span><div><h3>Informasi toko</h3><p>Identitas toko aktif</p></div></div><div className="settings-form-grid"><label>Nama toko<input value={currentStore?.name || ''} readOnly /></label><label>Kota / lokasi<input value={currentStore?.city || ''} readOnly placeholder="Belum diatur" /></label><label>ID internal<input value={currentStore?.id || '—'} readOnly /></label><label>Peran Anda<input value={roleLabel(currentRole)} readOnly /></label></div><div className="settings-note"><LockKeyhole size={15} /> Untuk mengubah informasi toko, gunakan konfigurasi akun yang memiliki akses pemilik.</div><label className="qris-field">ID toko untuk login karyawan<input value={storeCodeDraft} onChange={e => setStoreCodeDraft(e.target.value.toUpperCase().replace(/\\s+/g, '-'))} readOnly={!isStoreOwner || demo} maxLength={20} placeholder="Contoh: KEDAI-01" /><small>3–20 karakter: huruf, angka, dan tanda hubung. Harus unik di seluruh platform.</small></label>{isStoreOwner && !demo && <button className="button button-primary" onClick={saveStoreCode} disabled={storeCodeBusy || !storeCodeDraft.trim() || storeCodeDraft === (currentStore?.store_code || '')}>{storeCodeBusy ? <span className="spinner" /> : <Check size={16} />} Simpan ID toko</button>}{isStoreOwner && <button className="button button-secondary" onClick={() => { setStoreDraft({ name: '', city: '' }); setModal({ type: 'store' }) }}><Plus size={16} /> Tambah toko lain</button>}</section>
      <section className="panel settings-section"><div className="settings-section-heading"><span className="settings-icon blue"><Printer size={19} /></span><div><h3>Printer struk</h3><p>Hubungkan printer kasir</p></div><span className="optional-tag">Opsional</span></div><div className="integration-card"><div className="integration-graphic printer-graphic"><Printer size={28} /></div><div className="integration-copy"><strong>Printer Bluetooth / thermal</strong><p>Deteksi printer BLE yang didukung browser. Untuk perangkat Bluetooth Classic tertentu, gunakan aplikasi bridge atau cetak melalui dialog sistem.</p><span className="integration-status"><span className="status-indicator gray" /> Belum terhubung</span></div></div><div className="settings-actions"><button className="button button-primary" onClick={openPrinter}><Bluetooth size={16} /> Cari printer Bluetooth</button><button className="button button-secondary" onClick={() => printReceipt(sales[0])} disabled={!sales.length}><Printer size={16} /> Tes cetak</button></div><p className="settings-footnote">Dukungan Bluetooth langsung bervariasi menurut browser, sistem operasi, dan profil printer. Tombol tes menggunakan dialog cetak browser.</p></section>
      <section className="panel settings-section qris-settings-panel"><div className="settings-section-heading"><span className="settings-icon violet"><QrCode size={19} /></span><div><h3>Pembayaran QRIS</h3><p>Atur metode pembayaran khusus toko aktif</p></div><span className={`integration-badge ${demo ? 'demo-badge' : (qrisSavedSettings ? 'configured-badge' : '')}`}>{demo ? 'Mode demo' : qrisSavedSettings ? 'Terkonfigurasi' : 'Belum diatur'}</span></div>
        {demo ? <div className="settings-note"><KeyRound size={15} /> Mode demo tidak menyimpan kredensial merchant atau menerima pembayaran nyata. Keluar dari demo dan hubungkan Supabase untuk mengatur QRIS.</div> : <>
          <label className="qris-field">Metode QRIS yang digunakan<select value={qrisSettingsDraft.mode} onChange={e => setQrisSettingsDraft(v => ({ ...v, mode: e.target.value }))}><option value="static">QRIS statis</option><option value="dynamic">QRIS dinamis</option><option value="both">Keduanya (statis dan dinamis)</option></select></label>
          {(qrisSettingsDraft.mode === 'static' || qrisSettingsDraft.mode === 'both') && <div className="qris-upload-area"><label className="qris-field">Nama merchant yang tampil<input value={qrisSettingsDraft.merchant_display_name} onChange={e => setQrisSettingsDraft(v => ({ ...v, merchant_display_name: e.target.value }))} placeholder={currentStore?.name || 'Nama toko sesuai QRIS'} /></label><label className="qris-field">Gambar QRIS statis<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setQrisStaticFile(e.target.files?.[0] || null)} /></label><small>{qrisStaticFile ? `File dipilih: ${qrisStaticFile.name}` : qrisSavedSettings?.static_qr_storage_path ? 'QRIS statis sudah tersimpan. Pilih file baru untuk menggantinya.' : 'Unggah QRIS dari penyedia/acquirer resmi toko ini. Maksimal 5 MB.'}</small></div>}
          {(qrisSettingsDraft.mode === 'dynamic' || qrisSettingsDraft.mode === 'both') && <div className="qris-upload-area"><div className="settings-note"><KeyRound size={15} /> Setiap toko memakai Server Key milik akun merchant sendiri. Kunci dienkripsi di server dan tidak dikirim kembali ke browser.</div><label className="qris-field">Provider<select value="midtrans" disabled><option value="midtrans">Midtrans (QRIS)</option></select></label><label className="qris-field">ID merchant<input value={qrisSettingsDraft.provider_merchant_id} onChange={e => setQrisSettingsDraft(v => ({ ...v, provider_merchant_id: e.target.value }))} placeholder="ID merchant dari dashboard provider" /></label><label className="qris-field">Server Key merchant<input type="password" autoComplete="new-password" value={qrisSettingsDraft.provider_server_key} onChange={e => setQrisSettingsDraft(v => ({ ...v, provider_server_key: e.target.value }))} placeholder={qrisSavedSettings?.dynamic_status === 'connected' ? 'Tersimpan aman — isi hanya jika ingin mengganti' : 'Masukkan Server Key merchant'} /></label><label className="qris-checkbox-field"><input type="checkbox" checked={qrisSettingsDraft.provider_is_production} onChange={e => setQrisSettingsDraft(v => ({ ...v, provider_is_production: e.target.checked }))} /> Gunakan environment produksi <small>Biarkan tidak dicentang untuk Sandbox saat pengujian.</small></label><small>Status dinamis: {qrisSavedSettings?.dynamic_status === 'connected' ? 'kredensial tersimpan; tetap wajib menguji webhook merchant' : 'belum terhubung'}</small></div>}
          <button className="button button-primary" onClick={saveQrisSettings} disabled={qrisSettingsBusy || (qrisSettingsDraft.mode === 'static' || qrisSettingsDraft.mode === 'both') && !qrisStaticFile && !qrisSavedSettings?.static_qr_storage_path}>{qrisSettingsBusy ? <span className="spinner" /> : <CheckCircle2 size={16} />} Simpan pengaturan QRIS</button>
          <p className="settings-footnote">QRIS statis harus dikonfirmasi setelah memeriksa transaksi pada portal merchant. QRIS dinamis hanya dianggap lunas setelah webhook bertanda tangan valid.</p>
        </>}</section>
      <section className="panel settings-section"><div className="settings-section-heading"><span className="settings-icon amber"><Bell size={19} /></span><div><h3>Notifikasi & laporan</h3><p>Pengingat stok dan ringkasan harian</p></div></div><div className="setting-toggle-row"><span className="setting-toggle-icon"><AlertTriangle size={17} /></span><div><strong>Stok menipis</strong><small>Ingatkan saat jumlah barang mencapai stok minimum.</small></div><button className="button button-secondary button-sm" onClick={enablePush}><Bell size={14} /> Aktifkan push</button></div><div className="setting-toggle-row"><span className="setting-toggle-icon"><FileSpreadsheet size={17} /></span><div><strong>Laporan harian</strong><small>Ringkasan penjualan dapat dijadwalkan dikirim melalui push notification.</small></div><button className="button button-secondary button-sm" onClick={() => { setReportDate(todayISO()); navigate('reports') }}>Lihat laporan</button></div><p className="settings-footnote">Pengiriman push saat aplikasi tertutup membutuhkan konfigurasi VAPID dan fungsi terjadwal di Supabase. Lihat README untuk langkah aktivasi.</p></section>
      <section className="panel settings-section appearance-settings"><div className="settings-section-heading"><span className="settings-icon"><Sun size={19} /></span><div><h3>Tampilan aplikasi</h3><p>Sesuaikan dengan kenyamanan Anda</p></div></div><div className="theme-options"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}><span className="theme-preview light-preview"><i /><i /><i /></span><strong><Sun size={16} /> Mode terang</strong>{theme === 'light' && <CheckCircle2 size={17} />}</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview"><i /><i /><i /></span><strong><Moon size={16} /> Mode gelap</strong>{theme === 'dark' && <CheckCircle2 size={17} />}</button></div></section>
      <section className="panel settings-section"><div className="settings-section-heading"><span className="settings-icon green"><DownloadCloud size={19} /></span><div><h3>Aplikasi perangkat (PWA)</h3><p>Pasang TokoFlow di layar utama</p></div></div><p className="settings-long-copy">Akses lebih cepat dari layar utama dan dapat membuka shell aplikasi saat koneksi terbatas. Fitur install sengaja tidak ditampilkan pada halaman kasir agar area transaksi tetap fokus.</p><button className="button button-secondary" disabled={isCashierPage} onClick={installApp}><Download size={16} /> Install TokoFlow POS</button>{!deferredPrompt && <small className="settings-footnote">Jika tombol install tidak menampilkan prompt, gunakan menu browser “Tambahkan ke layar utama”.</small>}</section></div>
  </>

  const renderAdmin = () => {
    const term = adminSearch.trim().toLocaleLowerCase('id-ID')
    const filteredAdminStores = (demo ? demoStores.map(s => ({ ...s, status: 'active' })) : adminStores).filter(store =>
      [store.name, store.city, store.id].some(value => String(value || '').toLocaleLowerCase('id-ID').includes(term))
    )
    const filteredAdminUsers = (demo ? [{ id: 'demo-user', full_name: 'Ria Aditya', is_super_admin: true }, ...Array.from({ length: 5 }, (_, i) => ({ id: `demo-u-${i}`, full_name: ['Dian Lestari', 'Budi Santoso', 'Intan Prameswari', 'Agus Setiawan', 'Maya Putri'][i], is_super_admin: false }))] : adminUsers).filter(user =>
      [user.full_name, user.id, user.is_super_admin ? 'administrator' : 'pengguna'].some(value => String(value || '').toLocaleLowerCase('id-ID').includes(term))
    )
    const filteredAuditLogs = adminAuditLogs.filter(log =>
      [log.action, log.target_type, log.target_id, log.actor_id, JSON.stringify(log.details || {})].some(value => String(value || '').toLocaleLowerCase('id-ID').includes(term))
    )
    const auditActionLabel = (action) => ({ store_status_changed: 'Perubahan status toko' }[action] || action || 'Aktivitas admin')
    return <>
      <PageTitle eyebrow="KONTROL PLATFORM" title="Administrator" description="Kelola toko dan akun yang terdaftar di platform." actions={<button className="button button-secondary" onClick={loadAdminSummary}><RefreshCcw size={16} /> Muat ulang</button>} />
      <div className="admin-toolbar panel">
        <div className="admin-search"><Search size={17} /><input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="Cari nama toko, lokasi, ID, atau aktivitas…" aria-label="Cari data administrator" /><button className="button button-secondary button-sm" onClick={() => setAdminSearch('')} disabled={!adminSearch}>Reset</button></div>
        <div className="admin-tabs" role="tablist" aria-label="Jenis data administrator">
          <button role="tab" aria-selected={adminTab === 'stores'} className={adminTab === 'stores' ? 'active' : ''} onClick={() => setAdminTab('stores')}>Toko ({filteredAdminStores.length})</button>
          <button role="tab" aria-selected={adminTab === 'users'} className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>Akun ({filteredAdminUsers.length})</button>
          <button role="tab" aria-selected={adminTab === 'audit'} className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}>Audit ({filteredAuditLogs.length})</button>
        </div>
      </div>
      <div className="kpi-grid">
        <KPI icon={Building2} label="Total toko" value={(demo ? demoStores.length : adminStores.length).toLocaleString('id-ID')} trendLabel="Terdaftar di platform" tone="green" />
        <KPI icon={Users} label="Total akun" value={(demo ? 18 : adminUsers.length).toLocaleString('id-ID')} trendLabel="Akun yang terdaftar" tone="blue" />
        <KPI icon={ShieldCheck} label="Toko aktif" value={(demo ? demoStores.length : adminStores.filter(s => s.status !== 'suspended').length).toLocaleString('id-ID')} trendLabel="Dapat diakses anggota" tone="purple" />
        <KPI icon={Activity} label="Audit terbaru" value={adminAuditLogs.length.toLocaleString('id-ID')} trendLabel="Catatan yang tersedia" tone="amber" />
      </div>
      {adminTab === 'stores' && <section className="panel admin-table-panel"><div className="panel-heading"><div><h3>Daftar toko</h3><p>Penangguhan toko memblokir akses anggota melalui kebijakan database.</p></div><span className="admin-access-pill"><ShieldCheck size={14} /> Admin terverifikasi</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nama toko</th><th>Pemilik (ID akun)</th><th>Lokasi</th><th>ID toko</th><th>Dibuat</th><th>Status</th>{!demo && <th>Tindakan</th>}</tr></thead><tbody>{filteredAdminStores.map(s => <tr key={s.id}><td><div className="admin-store-cell"><span><Store size={16} /></span><strong>{s.name}</strong></div></td><td><span className="mono-text">{s.owner_id || '—'}</span></td><td>{s.city || 'Belum diatur'}</td><td><div><strong>{s.store_code || 'Belum ada kode'}</strong><small className="mono-text" style={{ display: 'block' }}>{s.id}</small></div></td><td>{s.created_at ? formatDate(s.created_at, { year: 'numeric' }) : 'Data demo'}</td><td><StatusPill status={s.status === 'suspended' ? 'suspended' : 'active'} /></td>{!demo && <td><button className={`button button-sm ${s.status === 'suspended' ? 'button-primary' : 'button-secondary'}`} disabled={adminBusyStoreId === s.id} onClick={() => setAdminStoreStatus(s)}>{adminBusyStoreId === s.id ? <span className="spinner" /> : s.status === 'suspended' ? 'Aktifkan' : 'Tangguhkan'}</button></td>}</tr>)}</tbody></table>{filteredAdminStores.length === 0 && <div className="admin-empty-results">Tidak ada toko yang cocok dengan pencarian.</div>}</div></section>}
      {adminTab === 'users' && <section className="panel admin-table-panel"><div className="panel-heading"><div><h3>Akun pengguna</h3><p>Akun yang terlihat dari database otorisasi.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nama pengguna</th><th>ID akun</th><th>Peran platform</th><th>Dibuat</th></tr></thead><tbody>{filteredAdminUsers.map(u => <tr key={u.id}><td><div className="employee-name-cell"><span className="avatar avatar-owner">{initials(u.full_name)}</span><strong>{u.full_name || 'Pengguna'}</strong></div></td><td><span className="mono-text">{u.id}</span></td><td>{u.is_super_admin ? <span className="role-pill owner">Administrator</span> : <span className="role-pill viewer">Pengguna</span>}</td><td>{u.created_at ? formatDate(u.created_at, { year: 'numeric' }) : 'Data demo'}</td></tr>)}</tbody></table>{filteredAdminUsers.length === 0 && <div className="admin-empty-results">Tidak ada akun yang cocok dengan pencarian.</div>}</div></section>}
      {adminTab === 'audit' && <section className="panel admin-table-panel"><div className="panel-heading"><div><h3>Riwayat audit administrator</h3><p>Catatan perubahan administratif terbaru yang tersimpan di database.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Aktivitas</th><th>Target</th><th>ID target</th><th>Detail</th><th>Waktu</th></tr></thead><tbody>{filteredAuditLogs.map(log => <tr key={log.id}><td>{auditActionLabel(log.action)}</td><td>{log.target_type === 'store' ? 'Toko' : 'Akun'}</td><td><span className="mono-text">{log.target_id}</span></td><td><span className="audit-details">{JSON.stringify(log.details || {})}</span></td><td>{log.created_at ? formatDate(log.created_at, { year: 'numeric', month: 'short', day: '2-digit' }) : '—'}</td></tr>)}</tbody></table>{filteredAuditLogs.length === 0 && <div className="admin-empty-results">{demo ? 'Riwayat audit hanya tersedia pada mode database.' : 'Belum ada aktivitas audit atau migrasi database belum diterapkan.'}</div>}</div></section>}
      <div className="admin-warning"><ShieldCheck size={18} /><p><strong>Keamanan administrator.</strong> Perubahan status toko dilakukan melalui RPC yang memverifikasi superadmin dan mencatat audit dalam transaksi yang sama. Akses admin hanya boleh diberikan melalui backend tepercaya.</p></div>
    </>
  }

  if (authLoading) return <div className="loading-screen"><div className="loading-brand"><Logo /></div><span className="spinner spinner-large" /><p>Menyiapkan ruang kerja…</p></div>
  if (!session && !demo) return <AuthScreen onDemo={startDemo} onAuth={onAuth} busy={authBusy} error={authError} setError={setAuthError} />
  if (!demo && !stores.length && !loadingData) return <div className="onboarding-screen"><div className="onboarding-card"><Logo /><div className="onboarding-icon"><Store size={28} /></div><span className="eyebrow">LANGKAH PERTAMA</span><h1>Buat toko pertama Anda</h1><p>Setiap toko memiliki data inventaris dan transaksi yang terisolasi. Anda dapat menambahkan lokasi lain setelah masuk.</p><form onSubmit={createStore} className="form-stack"><label>Nama toko<input value={storeDraft.name} onChange={e => setStoreDraft({ ...storeDraft, name: e.target.value })} placeholder="Contoh: Kedai Rona" required /></label><label>Kota / lokasi <span className="optional-text">Opsional</span><input value={storeDraft.city} onChange={e => setStoreDraft({ ...storeDraft, city: e.target.value })} placeholder="Contoh: Bekasi" /></label><button className="button button-primary button-wide" type="submit" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Plus size={17} />}Buat toko</button></form><button className="text-action logout-onboarding" onClick={signOut}><LogOut size={14} /> Keluar akun</button></div></div>

  return <div className={`app-shell ${sidebarOpen ? 'sidebar-is-open' : ''}`}>
    {sidebarOpen && <button className="mobile-scrim" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)} />}
    <aside className="sidebar">
      <div className="sidebar-brand-row"><Logo /><button className="sidebar-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Tutup navigasi"><X size={18} /></button></div>
      <button className="store-switcher" onClick={() => { if (stores.length > 1) setModal({ type: 'stores' }); else if (isStoreOwner) { setStoreDraft({ name: '', city: '' }); setModal({ type: 'store' }) } }}><span className="store-avatar">{initials(currentStore?.name || 'TF')}</span><span className="store-switcher-text"><small>WORKSPACE</small><strong>{currentStore?.name || 'Pilih toko'}</strong><em>{currentStore?.city || 'Lokasi utama'}</em></span><ChevronDown size={16} /></button>
      <div className="nav-section-label">MENU UTAMA</div><nav className="main-nav">{visibleNav.filter(i => i.key !== 'settings' && i.key !== 'admin').map(item => <button key={item.key} className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)}><item.icon size={19} strokeWidth={page === item.key ? 2.2 : 1.8} /><span>{item.label}</span>{item.key === 'inventory' && lowStockProducts.length > 0 && <i className="nav-count">{lowStockProducts.length}</i>}{page === item.key && <i className="nav-active-mark" />}</button>)}</nav>
      <div className="nav-section-label nav-section-secondary">PREFERENSI</div><nav className="main-nav">{visibleNav.filter(i => i.key === 'settings' || i.key === 'admin').map(item => <button key={item.key} className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)}><item.icon size={19} strokeWidth={page === item.key ? 2.2 : 1.8} /><span>{item.label}</span>{page === item.key && <i className="nav-active-mark" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sync-status"><span className="sync-icon"><Cloud size={17} /></span><span><strong>{demo ? 'Mode demo aktif' : 'Cloud sync aktif'}</strong><small><i /> {demo ? 'Data contoh lokal' : 'Semua data tersinkron'}</small></span></div><button className="sidebar-help" onClick={() => showToast('Bantuan: baca README proyek untuk panduan integrasi dan deployment.', 'info')}><span><CircleHelp size={18} /></span><div><strong>Butuh bantuan?</strong><small>Pusat bantuan TokoFlow</small></div><ExternalLink size={14} /></button><div className="sidebar-user"><span className="user-avatar">{initials(displayName)}</span><div className="sidebar-user-details"><strong>{displayName}</strong><small>{roleLabel(currentRole)}{demo ? ' · Demo' : ''}</small></div><button className="icon-button logout-icon" onClick={signOut} aria-label="Keluar" title="Keluar"><LogOut size={17} /></button></div></div>
    </aside>
    <main className={`main-area ${isCashierPage ? 'main-cashier' : ''}`}>
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Buka navigasi"><Menu size={20} /></button><div className="breadcrumb"><span>{currentStore?.name || 'Toko'}</span><ChevronRight size={14} /><strong>{({ dashboard: 'Ringkasan', cashier: 'Kasir', inventory: 'Inventaris', transactions: 'Transaksi', reports: 'Laporan', employees: 'Karyawan', settings: 'Pengaturan', admin: 'Administrator' }[page] || 'Ringkasan')}</strong></div></div><div className="topbar-right"><span className="topbar-date"><CalendarDays size={15} />{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span><button className="quick-search-button" onClick={() => { setMobileSearchOpen(v => !v); setGlobalSearch('') }}><Search size={17} /><span>Cari menu…</span><kbd>⌘ K</kbd></button>{mobileSearchOpen && <div className="global-search-popover"><div className="search-input"><Search size={16} /><input autoFocus value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Cari halaman…" /><button onClick={() => setMobileSearchOpen(false)}><X size={15} /></button></div>{visibleNav.filter(i => i.label.toLowerCase().includes(globalSearch.toLowerCase())).map(i => <button key={i.key} onClick={() => { navigate(i.key); setMobileSearchOpen(false) }}><i.icon size={16} />{i.label}<ArrowRight size={14} /></button>)}</div>}
        {!isCashierPage && <button className="install-button" onClick={installApp}><DownloadCloud size={16} /><span>Install app</span></button>}
        <div className="topbar-notification-wrap"><IconButton icon={Bell} label="Notifikasi" onClick={() => setNotificationOpen(v => !v)} badge={notifications.length > 0} className="notification-trigger" />{notificationOpen && <div className="notification-popover"><div className="notification-popover-head"><div><strong>Notifikasi</strong><small>{notifications.length} pembaruan</small></div><button onClick={() => setNotificationOpen(false)}><X size={16} /></button></div>{notifications.length ? notifications.map(n => <div className="notification-item" key={n.id}><span className={`notification-type-icon ${n.type}`}>{n.type === 'warning' ? <AlertTriangle size={16} /> : <FileSpreadsheet size={16} />}</span><div><strong>{n.title}</strong><p>{n.body}</p><small>{n.time}</small></div></div>) : <div className="notification-empty"><Bell size={20} /><p>Belum ada notifikasi baru.</p></div>}<button className="notification-footer" onClick={enablePush}><Bell size={14} /> Aktifkan push notification</button></div>}</div>
        <button className="theme-toggle topbar-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Ganti tema" title={theme === 'light' ? 'Mode gelap' : 'Mode terang'}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button><span className="topbar-divider" /><button className="topbar-profile" onClick={() => showToast(`${displayName} · ${session?.user?.email || 'Mode demo'}`, 'info')}><span className="user-avatar top-avatar">{initials(displayName)}</span><ChevronDown size={14} /></button></div></header>
      {loadingData && <div className="sync-banner"><span className="spinner spinner-dark" /> Memperbarui data toko…</div>}
      <div className={`page-content ${isCashierPage ? 'cashier-page-content' : ''}`}>
        {page === 'dashboard' && renderDashboard()}
        {page === 'cashier' && renderCashier()}
        {page === 'inventory' && renderInventory()}
        {page === 'transactions' && renderTransactions()}
        {page === 'reports' && renderReports()}
        {page === 'employees' && renderEmployees()}
        {page === 'settings' && renderSettings()}
        {page === 'admin' && (isSuperAdmin ? renderAdmin() : <EmptyState icon={ShieldCheck} title="Akses dibatasi" text="Halaman ini hanya tersedia bagi administrator platform." />)}
      </div>
      <footer className="app-footer"><span>© 2026 TokoFlow POS <i /> Dibuat untuk bisnis Indonesia</span><span><span className="live-dot" /> {demo ? 'Mode demo' : 'Tersinkron dengan Supabase'}</span></footer>
    </main>
    <nav className="mobile-bottom-nav">{[
      { key: 'dashboard', label: 'Home', icon: Home }, { key: 'inventory', label: 'Stok', icon: Boxes }, { key: 'cashier', label: 'Kasir', icon: ShoppingCart }, { key: 'transactions', label: 'Transaksi', icon: ReceiptText }, { key: 'reports', label: 'Laporan', icon: BarChart3 },
    ].filter(item => visibleNav.some(nav => nav.key === item.key)).map(item => <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => navigate(item.key)}><span><item.icon size={20} /></span><small>{item.label}</small>{page === item.key && <i />}</button>)}</nav>

    {(modal?.type === 'product' || modal?.type === 'product-edit') && <Modal title={modal.type === 'product-edit' ? 'Edit produk' : 'Tambah barang baru'} subtitle={modal.type === 'product-edit' ? 'Ubah nama, gambar, kategori, dan informasi produk.' : 'Masukkan informasi barang dan stok awal.'} onClose={() => setModal(null)}><form className="form-stack" onSubmit={saveProduct}>
      <label>Nama barang<input autoFocus value={productDraft.name} onChange={e => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="Contoh: Kopi Susu Aren" required /></label>
      <div className="form-grid-two"><label>SKU<input value={productDraft.sku} onChange={e => setProductDraft({ ...productDraft, sku: e.target.value })} placeholder="MIN-001" /></label><label>Kode barcode<div className="field-with-action"><input value={productDraft.barcode} onChange={e => setProductDraft({ ...productDraft, barcode: e.target.value })} placeholder="Scan atau ketik" /><button type="button" onClick={() => showScanner('product')} aria-label="Scan barcode"><ScanLine size={17} /></button></div></label></div>
      <label>URL gambar produk<input type="url" value={productDraft.image_url} onChange={e => setProductDraft({ ...productDraft, image_url: e.target.value })} placeholder="https://contoh.com/gambar-produk.jpg" /><small className="field-help">Gunakan tautan gambar yang dapat diakses publik.</small></label><div className="form-grid-two"><label>Kategori<select value={productDraft.category} onChange={e => setProductDraft({ ...productDraft, category: e.target.value })}><option>Minuman</option><option>Makanan</option><option>Sembako</option><option>Aksesoris</option><option>Lainnya</option></select></label><label>Satuan<select value={productDraft.unit} onChange={e => setProductDraft({ ...productDraft, unit: e.target.value })}><option>pcs</option><option>cup</option><option>botol</option><option>pack</option><option>kg</option><option>gram</option><option>liter</option><option>dus</option></select></label></div>
      <div className="form-grid-two"><label>Harga jual (Rp)<input type="number" min="1" value={productDraft.price} onChange={e => setProductDraft({ ...productDraft, price: e.target.value })} placeholder="18000" required /></label><label>Harga modal (Rp)<input type="number" min="0" value={productDraft.cost} onChange={e => setProductDraft({ ...productDraft, cost: e.target.value })} placeholder="9000" /></label></div>
      <div className="form-grid-two"><label>Stok awal<input type="number" min="0" step="1" value={productDraft.stock} onChange={e => setProductDraft({ ...productDraft, stock: e.target.value })} placeholder="20" required /></label><label>Batas stok minimum<input type="number" min="0" step="1" value={productDraft.min_stock} onChange={e => setProductDraft({ ...productDraft, min_stock: e.target.value })} required /></label></div>
      <div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} {modal.type === 'product-edit' ? 'Simpan perubahan' : 'Simpan barang'}</button></div>
    </form></Modal>}

    {modal?.type === 'price' && <Modal title="Ubah harga barang" subtitle={modal.product?.name} onClose={() => setModal(null)}><form className="form-stack" onSubmit={savePrice}><div className="price-current-box"><span>Harga saat ini</span><strong>{idr(modal.product?.price)}</strong></div><label>Harga jual baru (Rp)<input autoFocus type="number" min="1" value={priceDraft.price} onChange={e => setPriceDraft({ ...priceDraft, price: e.target.value })} required /></label><p className="form-helper">Perubahan harga berlaku untuk transaksi berikutnya. Transaksi yang sudah selesai tidak diubah.</p><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} Simpan harga</button></div></form></Modal>}

    {modal?.type === 'stock' && <Modal title="Penyesuaian stok" subtitle={modal.product?.name} onClose={() => setModal(null)}><form className="form-stack" onSubmit={saveStock}><div className="stock-adjust-info"><ProductVisual product={modal.product || {}} large /><span><small>Stok saat ini</small><strong>{modal.product?.stock} {modal.product?.unit || 'unit'}</strong></span><span><small>Batas minimum</small><strong>{modal.product?.min_stock ?? 5} {modal.product?.unit || 'unit'}</strong></span></div><label>Perubahan jumlah stok<div className="field-with-stepper"><button type="button" onClick={() => setStockDraft({ ...stockDraft, qty_delta: String(Number(stockDraft.qty_delta || 0) - 1) })}><Minus size={16} /></button><input type="number" step="1" value={stockDraft.qty_delta} onChange={e => setStockDraft({ ...stockDraft, qty_delta: e.target.value })} required /><button type="button" onClick={() => setStockDraft({ ...stockDraft, qty_delta: String(Number(stockDraft.qty_delta || 0) + 1) })}><Plus size={16} /></button></div><small className="label-helper">Gunakan angka positif untuk stok masuk dan negatif untuk stok keluar.</small></label><label>Catatan penyesuaian<input value={stockDraft.note} onChange={e => setStockDraft({ ...stockDraft, note: e.target.value })} placeholder="Contoh: Stok opname / barang rusak" /></label><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} Simpan stok</button></div></form></Modal>}

    {modal?.type === 'employee' && <Modal title="Buat akun karyawan" subtitle="Email tidak diperlukan. Username berlaku di toko ini." onClose={() => setModal(null)}><form className="form-stack" onSubmit={saveEmployee}><label>Nama lengkap<input autoFocus value={employeeDraft.name} onChange={e => setEmployeeDraft({ ...employeeDraft, name: e.target.value })} placeholder="Nama karyawan" required /></label><label>Username<input value={employeeDraft.username} onChange={e => setEmployeeDraft({ ...employeeDraft, username: e.target.value.toLowerCase() })} placeholder="contoh: budi.kasir" minLength={3} maxLength={32} pattern="[a-z0-9._-]{3,32}" required /></label><label>Kata sandi awal<input type="password" value={employeeDraft.password} onChange={e => setEmployeeDraft({ ...employeeDraft, password: e.target.value })} placeholder="Minimal 8 karakter" minLength={8} autoComplete="new-password" required /></label><fieldset className="employee-role-checkboxes"><legend>Peran akses (bisa lebih dari satu)</legend>{[['cashier','Kasir — transaksi dan struk'],['inventory','Inventaris — stok dan barang'],['manager','Manajer — operasional dan laporan'],['viewer','Lihat saja — akses laporan']].map(([role,label]) => <label key={role}><input type="checkbox" checked={employeeDraft.roles.includes(role)} onChange={e => setEmployeeDraft(current => ({ ...current, roles: e.target.checked ? [...new Set([...current.roles, role])] : current.roles.filter(r => r !== role) }))} />{label}</label>)}</fieldset><div className="role-info-box"><ShieldCheck size={17} /><p>Karyawan masuk dengan ID toko, username, dan kata sandi. Jika lupa kata sandi, hubungi pemilik untuk mengatur ulang.</p></div><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} Buat akun</button></div></form></Modal>}


    {modal?.type === 'employee-roles' && <Modal title="Ubah peran karyawan" subtitle={`Pilih akses untuk ${modal.employee?.name || modal.employee?.username || 'karyawan'}.`} onClose={() => setModal(null)}><form className="form-stack" onSubmit={saveEmployeeRoles}><fieldset className="employee-role-checkboxes"><legend>Peran akses (bisa lebih dari satu)</legend>{[['cashier','Kasir — transaksi dan struk'],['inventory','Inventaris — stok dan barang'],['manager','Manajer — operasional dan laporan'],['viewer','Lihat saja — akses laporan']].map(([role,label]) => <label key={role}><input type="checkbox" checked={employeeRolesDraft.includes(role)} onChange={e => setEmployeeRolesDraft(current => e.target.checked ? [...new Set([...current, role])] : current.filter(r => r !== role))} />{label}</label>)}</fieldset><div className="role-info-box"><ShieldCheck size={17} /><p>Perubahan peran memengaruhi akses karyawan pada toko ini. Pilih minimal satu peran.</p></div><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} Simpan peran</button></div></form></Modal>}

    {modal?.type === 'employee-delete' && <Modal title="Hapus akun karyawan?" subtitle={`Akun ${modal.employee?.username || ''} akan dihapus dari toko ini.`} onClose={() => setModal(null)}><div className="form-stack"><div className="role-info-box"><AlertTriangle size={18} /><p>Tindakan ini tidak dapat dibatalkan. Jika akun tidak terhubung ke toko lain, akun login karyawan juga akan dihapus. Riwayat transaksi tidak dihapus oleh tindakan ini.</p></div><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="button" className="button button-primary" disabled={savingForm} onClick={deleteEmployee}>{savingForm ? <span className="spinner" /> : <Trash2 size={16} />} Hapus akun</button></div></div></Modal>}

    {modal?.type === 'employee-reset' && <Modal title="Atur ulang kata sandi" subtitle={`Akun karyawan: ${modal.employee?.username || ''}. Kata sandi lama tidak dapat dilihat.`} onClose={() => setModal(null)}><form className="form-stack" onSubmit={resetEmployeePassword}><label>Kata sandi baru<input type="password" value={employeeResetPassword} onChange={e => setEmployeeResetPassword(e.target.value)} placeholder="Minimal 8 karakter" minLength={8} autoComplete="new-password" required /></label><div className="role-info-box"><KeyRound size={17} /><p>Berikan kata sandi baru ini langsung kepada karyawan secara aman.</p></div><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Check size={16} />} Simpan kata sandi</button></div></form></Modal>}

    {modal?.type === 'store' && <Modal title="Tambah toko baru" subtitle="Setiap toko memiliki inventaris dan laporan terpisah." onClose={() => setModal(null)}><form className="form-stack" onSubmit={createStore}><label>Nama toko<input autoFocus value={storeDraft.name} onChange={e => setStoreDraft({ ...storeDraft, name: e.target.value })} placeholder="Contoh: Cabang Selatan" required /></label><label>Kota / lokasi<input value={storeDraft.city} onChange={e => setStoreDraft({ ...storeDraft, city: e.target.value })} placeholder="Contoh: Bekasi" /></label><div className="role-info-box"><LockKeyhole size={17} /><p>Barang dan transaksi toko baru tidak otomatis bercampur dengan toko yang sudah ada.</p></div><div className="modal-form-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary" disabled={savingForm}>{savingForm ? <span className="spinner" /> : <Plus size={16} />} Buat toko</button></div></form></Modal>}

    {modal?.type === 'stores' && <Modal title="Pilih toko aktif" subtitle="Dashboard menampilkan data untuk toko yang dipilih." onClose={() => setModal(null)}><div className="store-picker-list">{stores.map(s => <button key={s.id} className={s.id === storeId ? 'active' : ''} onClick={() => { switchStore(s.id); setModal(null) }}><span className="store-avatar">{initials(s.name)}</span><span><strong>{s.name}</strong><small>{s.city || 'Lokasi belum diatur'} · {roleLabel(s.role)}</small></span>{s.id === storeId ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}</button>)}</div>{isStoreOwner && <button className="button button-secondary button-wide" onClick={() => { setModal(null); setStoreDraft({ name: '', city: '' }); setModal({ type: 'store' }) }}><Plus size={16} /> Tambah toko lain</button>}</Modal>}

    {modal?.type === 'scanner' && <Modal title="Scan barcode" subtitle="Gunakan kamera belakang atau input kode secara manual." onClose={() => setModal(null)} width="small"><BarcodeScanner onDetected={onBarcodeDetected} onClose={() => setModal(null)} /></Modal>}

    {modal?.type === 'qris' && <Modal title="Pembayaran QRIS" subtitle={modal.demo ? 'Simulasi demo — tidak ada transaksi uang nyata' : `Struk ${modal.receipt_no || ''}`} onClose={() => { setModal(null); setQrisState(null) }} width="small"><div className="qris-modal-content"><div className="qris-amount-label">Total yang harus dibayar</div><strong className="qris-amount">{idr(modal.total)}</strong>{modal.demo ? <div className="demo-qr-placeholder"><QrCode size={72} /><strong>QRIS DEMO</strong><small>Bukan kode pembayaran asli</small></div> : modal.qr_url ? <div className="qris-generated-image"><img src={modal.qr_url} alt="Kode QRIS pembayaran" /></div> : <div className="demo-qr-placeholder"><QrCode size={62} /><strong>Menunggu kode QR</strong></div>}{modal.merchant_display_name && <p className="qris-merchant-name">{modal.merchant_display_name}</p>}<div className="qris-waiting"><span className="spinner spinner-dark" /><div><strong>{modal.demo ? 'Simulasi pembayaran' : modal.qris_mode === 'static' ? 'QRIS statis — konfirmasi manual' : 'Menunggu pembayaran pelanggan'}</strong><small>{modal.demo ? 'Klik tombol di bawah untuk simulasi sukses.' : modal.qris_mode === 'static' ? 'Pelanggan memasukkan nominal sesuai total. Kasir wajib memeriksa status pembayaran pada portal merchant sebelum mengonfirmasi.' : 'Status akan diperbarui otomatis setelah webhook pembayaran terverifikasi.'}</small></div></div>{modal.demo && <button className="button button-primary button-wide" onClick={confirmDemoQris}><CheckCircle2 size={17} /> Simulasikan pembayaran berhasil</button>}{!modal.demo && modal.qris_mode === 'static' && <button className="button button-primary button-wide" onClick={confirmStaticQris}><CheckCircle2 size={17} /> Saya sudah memeriksa pembayaran</button>}{!modal.demo && modal.qris_mode !== 'static' && <div className="qris-info-box"><Clock3 size={16} /><span>Jangan tutup halaman ini sebelum pembayaran dikonfirmasi oleh penyedia QRIS.</span></div>}<button className="button button-secondary button-wide" onClick={() => setModal(null)}>Tutup</button></div></Modal>}

    {modal?.type === 'receipt' && <Modal title="Detail transaksi" subtitle={modal.sale?.receipt_no} onClose={() => setModal(null)} width="small"><div className="receipt-detail"><div className="receipt-success"><span><CheckCircle2 size={25} /></span><strong>Transaksi {modal.sale?.status === 'paid' ? 'berhasil' : 'diperbarui'}</strong><small>{formatDate(modal.sale?.created_at, { year: 'numeric' })}</small></div><div className="receipt-number-box"><small>Nomor struk</small><strong>{modal.sale?.receipt_no || '—'}</strong><span>{paymentLabel(modal.sale?.payment_method)} · {modal.sale?.cashier_name || displayName}</span></div><div className="receipt-detail-items">{(modal.sale?.sale_items || []).map((item, i) => <div className="receipt-detail-item" key={item.id || `${item.product_id}-${i}`}><div><strong>{item.product_name || item.name || 'Barang'}</strong><small>{item.qty} × {idr(item.unit_price)}</small></div><strong>{idr(item.subtotal ?? item.qty * item.unit_price)}</strong></div>)}</div><div className="receipt-totals"><div><span>Subtotal</span><span>{idr(modal.sale?.subtotal ?? modal.sale?.total)}</span></div><div><span>Diskon</span><span>−{idr(modal.sale?.discount || 0)}</span></div><div className="receipt-grand-total"><strong>Total pembayaran</strong><strong>{idr(modal.sale?.total)}</strong></div></div><button className="button button-primary button-wide" onClick={() => printReceipt(modal.sale)}><Printer size={17} /> Cetak struk</button><button className="button button-secondary button-wide receipt-close-button" onClick={() => setModal(null)}>Selesai</button></div></Modal>}

    {toast && <div className={`toast toast-${toast.type || 'success'}`} role="status"><span>{toast.type === 'error' ? <AlertTriangle size={18} /> : toast.type === 'info' ? <CircleHelp size={18} /> : <CheckCircle2 size={18} />}</span><p>{toast.message}</p><button onClick={() => setToast('')} aria-label="Tutup notifikasi"><X size={15} /></button></div>}
  </div>
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])) }
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default App
