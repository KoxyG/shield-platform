import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/** AES-256-GCM ciphertext from `encrypt`, every field in base64. */
export type Encrypted = { iv: string; data: string; tag: string }

/**
 * Encrypts `plaintext` with AES-256-GCM under a 32-byte key. `context` is bound to
 * the ciphertext as associated data: `decrypt` fails unless it gets the same
 * context, so a ciphertext copied onto another record won't decrypt there.
 */
export function encrypt(
  key: Uint8Array,
  plaintext: string,
  context: string
): Encrypted {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(Buffer.from(context, "utf8"))
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    iv: iv.toString("base64"),
    data: data.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  }
}

/** Decrypts what `encrypt` returned. Throws if the key, context or data are wrong. */
export function decrypt(
  key: Uint8Array,
  encrypted: Encrypted,
  context: string
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "base64"),
    { authTagLength: 16 }
  )
  decipher.setAAD(Buffer.from(context, "utf8"))
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.data, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
