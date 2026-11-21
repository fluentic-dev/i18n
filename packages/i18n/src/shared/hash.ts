const MASK_64 = 0xffffffffffffffffn;
const C1 = 0x87c37b91114253d5n;
const C2 = 0x4cf5ad432745937fn;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const DEFAULT_HASH_LENGTH = 8;
export const MIN_HASH_LENGTH = 6;
export const MAX_HASH_LENGTH = 22;

export function normalizeHashLength(length = DEFAULT_HASH_LENGTH): number {
  if (!Number.isInteger(length) || length < MIN_HASH_LENGTH || length > MAX_HASH_LENGTH) {
    throw new RangeError(`[i18n] compiled.hashLength must be an integer from ${MIN_HASH_LENGTH} to ${MAX_HASH_LENGTH}`);
  }
  return length;
}

function rotateLeft(value: bigint, bits: bigint): bigint {
  return ((value << bits) | (value >> (64n - bits))) & MASK_64;
}

function mixFinal(value: bigint): bigint {
  value ^= value >> 33n;
  value = value * 0xff51afd7ed558ccdn & MASK_64;
  value ^= value >> 33n;
  value = value * 0xc4ceb9fe1a85ec53n & MASK_64;
  return (value ^ value >> 33n) & MASK_64;
}

function read64(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) value |= BigInt(bytes[offset + index]) << BigInt(index * 8);
  return value;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    result += BASE64URL[a >> 2];
    result += BASE64URL[(a & 3) << 4 | (b ?? 0) >> 4];
    if (b !== undefined) result += BASE64URL[(b & 15) << 2 | (c ?? 0) >> 6];
    if (c !== undefined) result += BASE64URL[c & 63];
  }
  return result;
}

/** MurmurHash3 x64 128-bit, encoded as unpadded base64url. */
export function murmurHash128(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const blocks = Math.floor(bytes.length / 16);
  let h1 = 0n;
  let h2 = 0n;

  for (let block = 0; block < blocks; block += 1) {
    let k1 = read64(bytes, block * 16);
    let k2 = read64(bytes, block * 16 + 8);
    k1 = rotateLeft(k1 * C1 & MASK_64, 31n) * C2 & MASK_64;
    h1 ^= k1;
    h1 = (rotateLeft(h1, 27n) + h2) * 5n + 0x52dce729n & MASK_64;
    k2 = rotateLeft(k2 * C2 & MASK_64, 33n) * C1 & MASK_64;
    h2 ^= k2;
    h2 = (rotateLeft(h2, 31n) + h1) * 5n + 0x38495ab5n & MASK_64;
  }

  const tail = blocks * 16;
  let k1 = 0n;
  let k2 = 0n;
  for (let index = bytes.length - 1; index >= tail + 8; index -= 1) {
    k2 = k2 << 8n | BigInt(bytes[index]);
  }
  for (let index = Math.min(bytes.length, tail + 8) - 1; index >= tail; index -= 1) {
    k1 = k1 << 8n | BigInt(bytes[index]);
  }
  if (k2) {
    k2 = rotateLeft(k2 * C2 & MASK_64, 33n) * C1 & MASK_64;
    h2 ^= k2;
  }
  if (k1) {
    k1 = rotateLeft(k1 * C1 & MASK_64, 31n) * C2 & MASK_64;
    h1 ^= k1;
  }

  h1 ^= BigInt(bytes.length);
  h2 ^= BigInt(bytes.length);
  h1 = h1 + h2 & MASK_64;
  h2 = h2 + h1 & MASK_64;
  h1 = mixFinal(h1);
  h2 = mixFinal(h2);
  h1 = h1 + h2 & MASK_64;
  h2 = h2 + h1 & MASK_64;
  const output = new Uint8Array(16);
  for (let index = 0; index < 8; index += 1) {
    output[index] = Number(h1 >> BigInt(index * 8) & 0xffn);
    output[index + 8] = Number(h2 >> BigInt(index * 8) & 0xffn);
  }
  return encodeBase64Url(output);
}

export function messageHash(identity: string, length = DEFAULT_HASH_LENGTH): string {
  return murmurHash128(identity).slice(0, normalizeHashLength(length));
}
