/** Reads a zip made by src/data/zip.ts (method "stored"). Test helper. */
export function unzip(bytes: Uint8Array): Array<{ path: string; content: string }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Array<{ path: string; content: string }> = [];
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const nameStart = at + 30;
    const dataStart = nameStart + nameLength + extraLength;
    out.push({
      path: new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength)),
      content: new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)),
    });
    at = dataStart + size;
  }
  return out;
}
