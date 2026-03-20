// ============================================================
// BLE Service — Capacitor Native + Web Bluetooth Fallback
//
// Uses @capacitor-community/bluetooth-le on iOS/Android (native).
// Falls back to Web Bluetooth on Chrome desktop (dev/testing).
// Parses HR + RR intervals from HR Service 0x180D.
// ============================================================

import { Capacitor } from '@capacitor/core';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHAR = '00002a37-0000-1000-8000-00805f9b34fb';
const HR_SERVICE_SHORT = 0x180D;

let connectedDevice = null;
let dataCallback = null;

// ── CAPACITOR BLE (native iOS + Android) ────────────────────

async function connectCapacitor() {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');

  await BleClient.initialize({ androidNeverForLocation: true });

  const device = await BleClient.requestDevice({
    services: [HR_SERVICE]
  });

  await BleClient.connect(device.deviceId, () => {
    connectedDevice = null;
    if (dataCallback) dataCallback({ disconnected: true });
  });

  connectedDevice = device;

  await BleClient.startNotifications(device.deviceId, HR_SERVICE, HR_CHAR, (value) => {
    const data = new DataView(value.buffer);
    const flags = data.getUint8(0);
    const is16bit = flags & 0x01;
    const hr = is16bit ? data.getUint16(1, true) : data.getUint8(1);

    const rr = [];
    if (flags & 0x10) {
      const offset = is16bit ? 3 : 2;
      for (let i = offset; i < data.byteLength; i += 2) {
        rr.push(data.getUint16(i, true));
      }
    }

    if (dataCallback) dataCallback({ hr, rr, timestamp: Date.now() });
  });

  return {
    device,
    name: device.name || 'BLE Device',
    onData(cb) { dataCallback = cb; },
    async disconnect() {
      try {
        await BleClient.stopNotifications(device.deviceId, HR_SERVICE, HR_CHAR);
        await BleClient.disconnect(device.deviceId);
      } catch {}
      connectedDevice = null;
    }
  };
}

// ── WEB BLUETOOTH (Chrome desktop fallback) ─────────────────

async function connectWeb() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [HR_SERVICE_SHORT] }],
    optionalServices: [HR_SERVICE_SHORT]
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HR_SERVICE_SHORT);
  const char = await service.getCharacteristic(0x2A37);
  await char.startNotifications();

  connectedDevice = device;

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
    disconnect() { try { device.gatt.disconnect(); } catch {}; connectedDevice = null; }
  };
}

// ── AUTO-DETECT ─────────────────────────────────────────────

export async function connectDevice() {
  if (Capacitor.isNativePlatform()) {
    return await connectCapacitor();
  }
  return await connectWeb();
}

export function isBleSupported() {
  return Capacitor.isNativePlatform() || !!navigator.bluetooth;
}

export function isConnected() {
  return connectedDevice !== null;
}

export async function initBLE() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.initialize({ androidNeverForLocation: true });
    } catch {}
  }
}
