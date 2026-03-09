// ============================================================
// vaultPatternAnalyzer.js — Vault pattern intelligence
// Analyzes vault entries for emotional patterns over time.
// 42 CFR Part 2 protected — NEVER surface raw vault data
// to corrections, courts, or non-clinical staff.
// ============================================================

class VaultPatternAnalyzer {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Analyze vault patterns for a user.
   * Returns aggregate patterns only — NEVER raw vault content.
   */
  async analyzePatterns(userId) {
    try {
      const entries = await this.pool.query(
        `SELECT
           vault_response->>'resonance_signal' as resonance,
           vault_response->>'impact_slider' as impact,
           vault_response->'emotional_tags' as tags,
           sc.coherence_score, sc.coherence_end, sc.completed_at
         FROM session_completions sc
         WHERE sc.user_id = $1
           AND sc.vault_response IS NOT NULL
         ORDER BY sc.completed_at DESC LIMIT 30`,
        [userId]
      );

      if (entries.rows.length < 3) {
        return { sufficient_data: false, patterns: null };
      }

      return {
        sufficient_data: true,
        patterns: {
          engagement: this._analyzeEngagement(entries.rows),
          emotional_themes: this._analyzeEmotionalThemes(entries.rows),
          coherence_correlation: this._correlateWithCoherence(entries.rows),
          vault_consistency: this._assessConsistency(entries.rows)
        }
      };
    } catch (err) {
      return { sufficient_data: false, error: err.message };
    }
  }

  _analyzeEngagement(rows) {
    const resonanceCount = rows.filter(r => r.resonance === 'true').length;
    const avgImpact = rows
      .map(r => parseFloat(r.impact))
      .filter(v => !isNaN(v))
      .reduce((s, v, _, a) => s + v / a.length, 0);

    return {
      resonance_rate: Math.round((resonanceCount / rows.length) * 100) / 100,
      avg_impact: Math.round(avgImpact * 100) / 100,
      entries_analyzed: rows.length
    };
  }

  _analyzeEmotionalThemes(rows) {
    const tagCounts = {};
    for (const row of rows) {
      if (!row.tags) continue;
      let tags = row.tags;
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { continue; }
      }
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      top_themes: sorted.map(([theme, count]) => ({ theme, count })),
      total_unique: Object.keys(tagCounts).length
    };
  }

  _correlateWithCoherence(rows) {
    const withImpact = rows
      .map(r => ({
        impact: parseFloat(r.impact),
        coherence: parseFloat(r.coherence_end || r.coherence_score)
      }))
      .filter(r => !isNaN(r.impact) && !isNaN(r.coherence));

    if (withImpact.length < 3) return null;

    const avgImpactHigh = withImpact.filter(r => r.coherence > 0.5);
    const avgImpactLow = withImpact.filter(r => r.coherence <= 0.5);

    return {
      high_coherence_avg_impact: avgImpactHigh.length > 0
        ? Math.round(avgImpactHigh.reduce((s, r) => s + r.impact, 0) / avgImpactHigh.length * 100) / 100
        : null,
      low_coherence_avg_impact: avgImpactLow.length > 0
        ? Math.round(avgImpactLow.reduce((s, r) => s + r.impact, 0) / avgImpactLow.length * 100) / 100
        : null,
      sample_size: withImpact.length
    };
  }

  _assessConsistency(rows) {
    const hasContent = rows.filter(r => r.resonance || r.impact || r.tags).length;
    return {
      completion_rate: Math.round((hasContent / rows.length) * 100) / 100,
      streak: this._countStreak(rows)
    };
  }

  _countStreak(rows) {
    let streak = 0;
    for (const row of rows) {
      if (row.resonance || row.impact || row.tags) streak++;
      else break;
    }
    return streak;
  }
}

module.exports = { VaultPatternAnalyzer };
