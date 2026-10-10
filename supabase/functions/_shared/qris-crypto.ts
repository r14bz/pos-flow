const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get('PAYMENT_CREDENTIALS_ENCRYPTION_KEY')
  if (!raw) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY belum dikonfigurasi.')
  const binary = atob(raw)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  if (bytes.byteLength !== 32) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY harus berupa base64 dari tepat 32 byte.')
  return bytes
}

export async function encryptCredential(value: string) {
  const key = await crypto.subtle.importKey('raw', getKeyBytes(), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value))
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decryptCredential(ciphertext: string, ivValue: string) {
  const key = await crypto.subtle.importKey('raw', getKeyBytes(), 'AES-GCM', false, ['decrypt'])
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivValue), c => c.charCodeAt(0))
  const cleartext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes)
  return decoder.decode(cleartext)
}
