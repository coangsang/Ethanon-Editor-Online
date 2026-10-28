const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16_LE_BOM = [0xff, 0xfe];
const UTF16_BE_BOM = [0xfe, 0xff];

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

/**
 * Decodes project XML consistently in the browser and Tauri.
 * Legacy assets may use UTF-16 with a BOM; all other files must be valid UTF-8.
 */
export function decodeProjectText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (startsWith(bytes, UTF16_LE_BOM)) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
  }
  if (startsWith(bytes, UTF16_BE_BOM)) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
  }
  if (startsWith(bytes, UTF8_BOM)) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3));
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
