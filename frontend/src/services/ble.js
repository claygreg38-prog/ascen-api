const HR_SERVICE = 0x180D;
const HR_CHAR = 0x2A37;

export async function connectDevice() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [HR_SERVICE] }],
    optionalServices: [HR_SERVICE]
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HR_SERVICE);
  const char = await service.getCharacteristic(HR_CHAR);
  await char.startNotifications();

  let dataCallback = null;

  char.addEventListener('characteristicvaluechanged', e => {
    const v = e.target.value;
    const hr = v.getUint8(1);
    const rr = [];
    for (let i = 2; i < v.byteLength; i += 2) rr.push(v.getUint16(i, true));
    if (dataCallback) dataCallback({ hr, rr, timestamp: Date.now() });
  });

  return {
    device,
    name: device.name || 'BLE Device',
    onData(cb) { dataCallback = cb; },
    disconnect() { try { device.gatt.disconnect(); } catch {} }
  };
}

export function isBleSupported() {
  return !!navigator.bluetooth;
}
