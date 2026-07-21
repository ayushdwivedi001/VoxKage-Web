/**
 * Production-grade Web Crypto AES-GCM Client-Side Secure Storage.
 * Encrypts API keys before persisting to localStorage so plain text strings
 * cannot be retrieved via simple localStorage.getItem() console inspection.
 */

async function getDerivedEncryptionKey(): Promise<CryptoKey> {
  const VAULT_SEED_KEY = "voxkage_vault_device_seed";
  let seed = localStorage.getItem(VAULT_SEED_KEY);
  if (!seed) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    let binaryStr = "";
    for (let i = 0; i < randomBytes.byteLength; i++) {
      binaryStr += String.fromCharCode(randomBytes[i]);
    }
    seed = btoa(binaryStr);
    localStorage.setItem(VAULT_SEED_KEY, seed);
  }
  
  const encoder = new TextEncoder();
  const rawKeyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(`VoxKage_Vault_${seed}`));

  return crypto.subtle.importKey(
    "raw",
    rawKeyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts sensitive string and returns base64 ciphertext with IV prefix
 */
export async function secureSaveKey(storageKey: string, plaintext: string): Promise<void> {
  if (!plaintext || plaintext.trim() === "") {
    localStorage.removeItem(storageKey);
    return;
  }
  try {
    const key = await getDerivedEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plaintext.trim())
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binaryStr = "";
    for (let i = 0; i < combined.byteLength; i++) {
      binaryStr += String.fromCharCode(combined[i]);
    }
    const encryptedB64 = btoa(binaryStr);
    localStorage.setItem(storageKey, `enc_v1:${encryptedB64}`);
  } catch (err) {
    console.error("Failed to securely encrypt key:", err);
    localStorage.setItem(storageKey, plaintext.trim());
  }
}

/**
 * Decrypts stored ciphertext back to plaintext with OperationError recovery
 */
export async function secureLoadKey(storageKey: string): Promise<string> {
  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) return "";

  if (!rawValue.startsWith("enc_v1:")) {
    await secureSaveKey(storageKey, rawValue);
    return rawValue;
  }

  try {
    const encryptedB64 = rawValue.replace("enc_v1:", "");
    const binaryStr = atob(encryptedB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const key = await getDerivedEncryptionKey();
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.warn("Decryption error fallback - returning raw value:", err);
    return rawValue.startsWith("enc_v1:") ? "" : rawValue;
  }
}
