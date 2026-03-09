// ============================================================
// victoryLapEngine.js — Victory lap + grounding anchor
// Triggered when a session achieves notable milestones.
// Grounding anchor provides post-session stabilization.
// ============================================================

class VictoryLapEngine {
  constructor() {
    this.victories = [];
  }

  /**
   * Check if session qualifies for a victory lap.
   * Called at the end of onSessionComplete.
   */
  evaluate(params) {
    const {
      sessionNumber, coherenceEnd, completionRate,
      stateSummary, coachingSummary, track,
      totalSessionsCompleted, advancementResult
    } = params;

    const result = { victory: false, type: null, message: null, grounding_anchor: null };

    // Track advancement victory
    if (advancementResult?.action === 'advanced') {
      result.victory = true;
      result.type = 'track_advancement';
      result.message = `You've moved to ${advancementResult.new_track}. Your body earned this.`;
      result.grounding_anchor = this._getGroundingAnchor('advancement');
      this.victories.push(result);
      return result;
    }

    // Milestone sessions
    const milestones = [5, 10, 25, 50, 75, 100, 120, 150];
    if (milestones.includes(totalSessionsCompleted)) {
      result.victory = true;
      result.type = 'milestone';
      result.message = this._getMilestoneMessage(totalSessionsCompleted);
      result.grounding_anchor = this._getGroundingAnchor('milestone');
      this.victories.push(result);
      return result;
    }

    // First flow state
    if (stateSummary?.time_in_flow > 0 && totalSessionsCompleted <= 15) {
      result.victory = true;
      result.type = 'first_flow';
      result.message = "You found your flow today. That's your nervous system settling in.";
      result.grounding_anchor = this._getGroundingAnchor('flow');
      this.victories.push(result);
      return result;
    }

    // Perfect session (high completion, no pauses, no panic)
    if (completionRate > 0.9 && coachingSummary?.total_interventions === 0) {
      result.victory = true;
      result.type = 'clean_session';
      result.message = "Clean run. No interventions needed. Your breath carried you.";
      this.victories.push(result);
      return result;
    }

    // Sustained regulation > 3 minutes
    if (coachingSummary?.max_sustained_regulation_sec > 180) {
      result.victory = true;
      result.type = 'sustained_regulation';
      result.message = "Three minutes of sustained regulation. That's your body learning to hold calm.";
      result.grounding_anchor = this._getGroundingAnchor('regulation');
      this.victories.push(result);
      return result;
    }

    return result;
  }

  _getMilestoneMessage(count) {
    const messages = {
      5: "Five sessions in. You're building a foundation.",
      10: "Ten sessions. Your nervous system is starting to remember.",
      25: "Twenty-five sessions. This is becoming part of you.",
      50: "Fifty sessions. Half a hundred moments of choosing yourself.",
      75: "Seventy-five. Your body carries this practice now.",
      100: "One hundred sessions. This is no longer something you do. It's who you are.",
      120: "One hundred twenty. The spiral gate awaits.",
      150: "One hundred fifty. You've completed the first spiral."
    };
    return messages[count] || `${count} sessions. Keep going.`;
  }

  _getGroundingAnchor(type) {
    const anchors = {
      advancement: {
        technique: 'feet_on_floor',
        instruction: 'Feel your feet on the floor. Three breaths. You earned this ground.',
        duration_sec: 15
      },
      milestone: {
        technique: 'hand_on_chest',
        instruction: 'Place your hand on your chest. Feel your heartbeat. This is your practice.',
        duration_sec: 10
      },
      flow: {
        technique: 'eyes_close',
        instruction: 'Close your eyes. Remember this feeling. Your body knows the way now.',
        duration_sec: 10
      },
      regulation: {
        technique: 'slow_exhale',
        instruction: 'One long exhale. Let it be the bridge between this session and the rest of your day.',
        duration_sec: 8
      }
    };
    return anchors[type] || anchors.milestone;
  }
}

module.exports = { VictoryLapEngine };
