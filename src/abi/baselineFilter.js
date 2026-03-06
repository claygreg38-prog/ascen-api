// ============================================================
// baselineFilter.js — Arrival baseline noise filtering
// Excludes speech, movement, coughs from arrival biometrics
// ============================================================

class BaselineFilter {
  constructor(config = {}) {
    this.samples = [];
    this.config = { minSamples: config.minSamples || 10, outlierThreshold: config.outlierThreshold || 2 };
  }

  addSample(biometrics) {
    this.samples.push({ ...biometrics, timestamp: Date.now() });
  }

  getFilteredBaseline() {
    if (this.samples.length < this.config.minSamples) {
      return this.samples.length > 0 ? this._average(this.samples) : null;
    }
    // Remove outliers (speech, movement artifacts)
    const hrs = this.samples.map(s => s.heart_rate || 72);
    const mean = hrs.reduce((a, b) => a + b, 0) / hrs.length;
    const std = Math.sqrt(hrs.reduce((s, h) => s + Math.pow(h - mean, 2), 0) / hrs.length);
    const filtered = this.samples.filter(s => {
      const hr = s.heart_rate || 72;
      return Math.abs(hr - mean) < std * this.config.outlierThreshold;
    });
    return this._average(filtered.length > 0 ? filtered : this.samples);
  }

  _average(samples) {
    const n = samples.length;
    return {
      heart_rate: Math.round(samples.reduce((s, x) => s + (x.heart_rate || 72), 0) / n),
      respiratory_rate: Math.round(samples.reduce((s, x) => s + (x.respiratory_rate || 14), 0) / n * 10) / 10,
      hrv: Math.round(samples.reduce((s, x) => s + (x.hrv || 45), 0) / n),
      coherence: Math.round(samples.reduce((s, x) => s + (x.coherence || 0.25), 0) / n * 100) / 100
    };
  }
}

module.exports = { BaselineFilter };
