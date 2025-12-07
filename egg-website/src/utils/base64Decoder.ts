export function decodeBase64SensorChunk(base64: string): number[] {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const dataView = new DataView(bytes.buffer);

  if (dataView.byteLength < 8 + 2 * 9) return [];

  let offset = 0;

  // 1. Timestamp (Float64)
  const timestamp = dataView.getFloat64(offset, true);
  offset += 8;

  // 2. Voltage (short, scaled by 1/100)
  const voltage = dataView.getInt16(offset, true) / 100;
  offset += 2;

  // 3–6. Quaternion: qx, qy, qz, qw (shorts, scaled by 1/32767)
  const qx = dataView.getInt16(offset, true) / 32767;
  const qy = dataView.getInt16(offset + 2, true) / 32767;
  const qz = dataView.getInt16(offset + 4, true) / 32767;
  const qw = dataView.getInt16(offset + 6, true) / 32767;
  offset += 8;

  // 7. Temperature (short, scaled by 1/50)
  const temperature = dataView.getInt16(offset, true) / 50;
  offset += 2;

  // 8. Humidity (short, scaled by 1/50)
  const humidity = dataView.getInt16(offset, true) / 50;
  offset += 2;

  // 9–10. Light1 and Light2 (raw shorts)
  const light1 = dataView.getInt16(offset, true);
  offset += 2;

  const light2 = dataView.getInt16(offset, true);
  offset += 2;

  // Final result: flat array of all sensor values
  return [
    timestamp,   
    qx, qy, qz, qw,   
    temperature,  
    humidity,  
    light1,    
    light2,     
    voltage,   
  ];
}
