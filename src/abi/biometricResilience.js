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
    this.sessionActive = false;
    this.disconnectEvents = [];
    this.manualPauseCount = 0;
    this.biometricUpdates = 0;
    this.lastBiometrics = null;
  }

  startSession() {
    this.sessionActive = true;
    this.disconnectEvents = [];
    this.manualPauseCount = 0;
    this.biometricUpdates = 0;
    this.lastBiometrics = null;
  }

  onBiometricUpdate(biometrics) {
    this.biometricUpdates++;
    this.lastBiometrics = biometrics;
    if (biometrics && biometrics.source === 'synthetic' && this.mode === 'ble') {
      // BLE was expected but we got synthetic — possible silent disconnect
      this.mode = 'synthetic';
      this.disconnectTime = Date.now();
      this.disconnectEvents.push({ time: Date.now(), type: 'silent_drop' });
    }
  }

  onManualPause() {
    this.manualPauseCount++;
  }

  endSession() {
    this.sessionActive = false;
  }

  getSessionAnnotation() {
    return {
      detection_mode: this.mode,
      disconnect_events: this.disconnectEvents.length,
      reconnect_count: this.reconnectCount,
      manual_pauses: this.manualPauseCount,
      total_biometric_updates: this.biometricUpdates,
      ended_in_synthetic: this.mode === 'synthetic'
    };
  }

  onDisconnect() {
    this.disconnectTime = Date.now();
    this.mode = 'synthetic';
    this.disconnectEvents.push({ time: Date.now(), type: 'explicit' });
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
    return {
      heart_rate: lastKnown.heart_rate || 72,
      coherence: lastKnown.coherence || 0.25,
      respiratory_rate: lastKnown.respiratory_rate || 14,
      synthetic: true
    };
  }
}

module.exports = { BiometricResilience };
