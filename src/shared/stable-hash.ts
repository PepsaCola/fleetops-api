/** FNV-1a: a cheap hash that is the same on every run and every server, so it picks things stably */
export function stableHash(text: string): number {
  let value = 0x811c9dc5
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 0x01000193)
  return value >>> 0
}
