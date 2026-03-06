// ============================================================
// biometricResilience.js — BLE disconnect handling
// Graceful degradation when Polar H10 drops mid-session
// ============================================================

class BiometricResilience {
  constructor(config = {}) {
    this.mode = 'ble'; // ble | camera | synthetic | none
    this.disconnectTime = null;
    this.reconnectCount = 0;
    this.syntheticBaseline = null;
  }

  onDisconnect() {
    this.disconnectTime = Date.now();
    this.mode = 'synthetic';
    return {
      fallback: true,
      mode: 'synthetic',
      message: 'Connection paused. Your breath pacer continues.',
      adjustments: { suppress_hr_display: true, suppress_coherence_display: true }
    };
  }

  onReconnect() {
    this.reconnectCount++;
    this.mode = 'ble';
    this.disconnectTime = null;
    return { restored: true, mode: 'ble', reconnect_count: this.reconnectCount };
  }

  getDetectionMode() { return this.mode; }

  getSyntheticBiometrics(lastKnown = {}) {
    // Generate reasonable synthetic data during disconnect
    return {
      heart_rate: lastKnown.heart_rate || 72,
      coherence: lastKnown.coherence || 0.25,
      respiratory_rate: lastKnown.respiratory_rate || 14,
      synthetic: true
    };
  }
}

module.exports = { BiometricResilience };
