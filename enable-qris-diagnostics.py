from pathlib import Path

path = Path('supabase/functions/create-qris-payment/index.ts')
if not path.is_file():
    raise SystemExit(f'File tidak ditemukan: {path}\nJalankan script dari folder utama repositori pos-flow.')

source = path.read_text(encoding='utf-8')
original = source

old = """    if (!paymentRes.ok || !payment.transaction_id) {
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })"""
new = """    if (!paymentRes.ok || !payment.transaction_id) {
      // Log only gateway status/error fields. Never log credentials or Authorization headers.
      console.error('[qris-diagnostic] Midtrans charge rejected', JSON.stringify({
        http_status: paymentRes.status,
        status_code: payment.status_code ?? null,
        status_message: payment.status_message ?? null,
        validation_messages: payment.validation_messages ?? null,
        message: payment.message ?? null,
      }))
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })"""
if old not in source:
    raise SystemExit('Gagal: blok penolakan Midtrans tidak cocok dengan versi file ini. Tidak ada perubahan dibuat.')
source = source.replace(old, new, 1)

old = """  } catch (err) {
    if (saleId) {"""
new = """  } catch (err) {
    console.error('[qris-diagnostic] Payment function failed', JSON.stringify({
      error_name: err instanceof Error ? err.name : 'UnknownError',
      error_message: err instanceof Error ? err.message : 'Unexpected error',
    }))
    if (saleId) {"""
if old not in source:
    raise SystemExit('Gagal: blok catch tidak cocok dengan versi file ini. Tidak ada perubahan dibuat.')
source = source.replace(old, new, 1)

if source == original:
    raise SystemExit('Tidak ada perubahan yang dibuat.')
path.write_text(source, encoding='utf-8')
print('Berhasil menambahkan log diagnostik yang tidak mencatat Server Key.')
print('Periksa perubahan dengan: git diff -- supabase/functions/create-qris-payment/index.ts')
print('Jangan deploy dulu sebelum memeriksa diff.')
