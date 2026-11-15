// UUID v5 (RFC 9562): SHA-1 of namespace + name. Used as the id of a push subscription, so that the same
// device always has the same id (PUT is idempotent). Must match PushSubscription::idFor() on the API.
// WebCrypto only: Web Push needs a secure context, where crypto.subtle is always available.

/** Namespace for URLs (RFC 9562, Uuid::NAMESPACE_URL on the API). */
export const UUID_NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  return Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16))
}

export async function uuidV5(name: string, namespace = UUID_NAMESPACE_URL): Promise<string> {
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(16 + nameBytes.length)
  input.set(uuidBytes(namespace))
  input.set(nameBytes, 16)

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input)).slice(0, 16)
  hash[6] = (hash[6]! & 0x0f) | 0x50 // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80 // RFC variant

  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
