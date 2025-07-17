export function decodeBase64ToFloat64ThenFloats(base64: string): number[] {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const dataView = new DataView(bytes.buffer);
  const result: number[] = [];

  // Decode first 8 bytes as Float64 (timestamp)
  if (dataView.byteLength < 8) return result; // not enough data
  result.push(dataView.getFloat64(0, true)); // true = little-endian

  // Decode remaining bytes as Float32
  for (let offset = 8; offset + 4 <= dataView.byteLength; offset += 4) {
    result.push(dataView.getFloat32(offset, true));
  }

  return result;
}