export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export function decodeBase64ToFloats(base64: string): number[] {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer);
  const floats: number[] = [];
  for (let i = 0; i < bytes.byteLength; i += 4) {
    floats.push(view.getFloat32(i, true)); // true = little-endian
  }
  return floats;
}

export function decodeBase64ToFloat64s(base64: string): number[] {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer);
  const floats: number[] = [];
  for (let i = 0; i < bytes.byteLength; i += 8) {
    floats.push(view.getFloat64(i, true));
  }
  return floats;
}

export function decodeBase64ToInts(base64: string): number[] {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer);
  const ints: number[] = [];
  for (let i = 0; i < bytes.byteLength; i += 4) {
    ints.push(view.getInt32(i, true));
  }
  return ints;
}