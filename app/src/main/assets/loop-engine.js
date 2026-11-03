/* Riff Forge 2.4 Lab | pure loop helpers (playback position, music choice, optional seam refinement). No external dependencies. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiffLoopEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Wraps any playback position into [start, end) so a paused loop resumes where it stopped.
  function loopOffset(start, end, pos) {
    var len = end - start;
    if (!(len > 0) || !Number.isFinite(pos)) return start;
    return start + (((pos - start) % len) + len) % len;
  }
  // Rest plays the « Montée » loop during its last riseSeconds; falls back to the rest loop if none exists.
  function pickLoop(stage, remaining, riseSeconds, loops) {
    var first = function (role) { return (loops || []).find(function (l) { return l.role === role; }) || null; };
    if (stage === 'effort') return first('effort');
    if (stage !== 'rest') return null;
    if (riseSeconds > 0 && remaining <= riseSeconds) return first('rise') || first('rest');
    return first('rest');
  }
  // Tachometer reading (× 1 000 tr/min) for the session gauge: idle, calm rest, climbing « Montée », red-zone effort.
  function rpmFor(stage, remaining, riseSeconds) {
    if (stage === 'effort') return 9.2;
    if (stage !== 'rest') return 0.9;
    if (riseSeconds > 0 && remaining <= riseSeconds) return 3 + 5 * (1 - Math.max(0, remaining) / riseSeconds);
    return 2.2;
  }
  function peaks(data, columns) {
    var out = [], step = Math.max(1, Math.floor(data.length / 1300));
    for (var n = 0; n < columns; n++) {
      var begin = Math.floor(n * data.length / columns), end = Math.min(data.length, begin + Math.max(1, Math.ceil(data.length / columns))), peak = 0;
      for (var i = begin; i < end; i += step) peak = Math.max(peak, Math.abs(data[i]));
      out.push(peak);
    }
    return out;
  }
  function risingCrossings(data, from, to) {
    var out = [];
    for (var i = Math.max(1, from); i <= Math.min(data.length - 1, to); i++) if (data[i - 1] < 0 && data[i] >= 0) out.push(i);
    return out;
  }
  function nearest(list, target) {
    return list.reduce(function (best, i) { return best === null || Math.abs(i - target) < Math.abs(best - target) ? i : best; }, null);
  }
  // Optional helper, never applied automatically: snaps start to a rising zero crossing, then looks around
  // the chosen end for the point whose surroundings best match the start's surroundings (smoothest seam).
  function refineLoop(data, sampleRate, start, end, opts) {
    opts = opts || {};
    var snap = Math.round((opts.snap || 0.01) * sampleRate), search = Math.round((opts.search || 0.04) * sampleRate), half = opts.window || 512;
    var s0 = Math.round(start * sampleRate), e0 = Math.round(end * sampleRate);
    var s = nearest(risingCrossings(data, s0 - snap, s0 + snap), s0);
    if (s === null) s = Math.max(0, Math.min(data.length - 1, s0));
    var best = null, bestScore = Infinity;
    risingCrossings(data, e0 - search, e0 + search).forEach(function (e) {
      if (e <= s + half) return;
      var score = 0, n = 0;
      for (var k = -half; k < half; k++) {
        var a = data[s + k], b = data[e + k];
        if (a === undefined || b === undefined) continue;
        score += (a - b) * (a - b); n++;
      }
      score = n ? score / n : Infinity;
      if (score < bestScore || (score === bestScore && Math.abs(e - e0) < Math.abs(best - e0))) { bestScore = score; best = e; }
    });
    var e = best === null ? e0 : best;
    // Microsecond precision: rounding to the millisecond would move the seam by ~44 samples at 44.1 kHz.
    return { start: Math.round(s / sampleRate * 1e6) / 1e6, end: Math.round(e / sampleRate * 1e6) / 1e6, matched: best !== null };
  }
  return { loopOffset: loopOffset, pickLoop: pickLoop, rpmFor: rpmFor, peaks: peaks, refineLoop: refineLoop };
});
