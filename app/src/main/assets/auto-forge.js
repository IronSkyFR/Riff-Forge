/* Riff Forge 2.4 Lab | Auto-Forge: offline music analysis (tempo, bars, intensity) and loop suggestions per session role.
   Game-audio approach: bar-aligned segments ranked by intensity (horizontal re-sequencing). Suggestions only, never enforced. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiffAutoForge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var HOP = 512;
  function mean(a, from, to) { from = from || 0; to = to === undefined ? a.length : to; var s = 0; for (var i = from; i < to; i++) s += a[i]; return to > from ? s / (to - from) : 0; }
  function at(a, x) { var i = Math.floor(x), f = x - i; return i + 1 < a.length ? a[i] * (1 - f) + a[i + 1] * f : (a[i] || 0); }
  // Per-hop RMS of the full signal, the low band (< 150 Hz: kick, bass) and the high band (> 3 kHz: cymbals, distortion).
  function bands(data, sr) {
    var n = Math.floor(data.length / HOP), full = new Float32Array(n), low = new Float32Array(n), high = new Float32Array(n);
    var aL = 1 - Math.exp(-2 * Math.PI * 150 / sr), aH = 1 - Math.exp(-2 * Math.PI * 3000 / sr), l = 0, h = 0;
    for (var f = 0; f < n; f++) {
      var sf = 0, sl = 0, sh = 0;
      for (var i = f * HOP, e = i + HOP; i < e; i++) { var x = data[i]; l += aL * (x - l); h += aH * (x - h); var hi = x - h; sf += x * x; sl += l * l; sh += hi * hi; }
      full[f] = Math.sqrt(sf / HOP); low[f] = Math.sqrt(sl / HOP); high[f] = Math.sqrt(sh / HOP);
    }
    return { full: full, low: low, high: high, rate: sr / HOP };
  }
  // Onset strength: half-wave rectified log-energy rise, summed over bands.
  function onsets(b) {
    var n = b.full.length, o = new Float32Array(n), arr = [b.low, b.full, b.high];
    for (var f = 1; f < n; f++) { var d = 0; for (var k = 0; k < 3; k++) d += Math.max(0, Math.log(1e-4 + arr[k][f]) - Math.log(1e-4 + arr[k][f - 1])); o[f] = d; }
    return o;
  }
  // Autocorrelation tempo in a gym-friendly range, gently weighted toward ~125 BPM to limit octave errors.
  function tempo(o, rate, minBpm, maxBpm) {
    minBpm = minBpm || 80; maxBpm = maxBpm || 180;
    var m = mean(o), best = 120, bestS = -Infinity;
    for (var bpm = minBpm; bpm <= maxBpm; bpm += 0.5) {
      var lag = 60 * rate / bpm, s = 0, c = 0;
      for (var f = 0; f + 2 * lag < o.length - 1; f++) { var a = o[f] - m; s += a * (at(o, f + lag) - m) + 0.5 * a * (at(o, f + 2 * lag) - m); c++; }
      var w = Math.exp(-0.5 * Math.pow(Math.log(bpm / 125) / Math.LN2 / 0.9, 2));
      s = c ? s / c * w : -Infinity;
      if (s > bestS) { bestS = s; best = bpm; }
    }
    // Fine pass: comparing 1 to 8 beats apart makes a 0.5 BPM error (≈ 1 beat of drift over 3 min) visible.
    var coarse = best; bestS = -Infinity;
    for (var fb = coarse - 0.6; fb <= coarse + 0.6; fb += 0.02) {
      var lg = 60 * rate / fb, fs = 0, fc = 0;
      for (var k = 1; k <= 8; k++) for (var g = 0; g + k * lg < o.length - 1; g += 2) { fs += (o[g] - m) * (at(o, g + k * lg) - m); fc++; }
      fs = fc ? fs / fc : -Infinity;
      if (fs > bestS) { bestS = fs; best = fb; }
    }
    return best;
  }
  // Beat phase (strongest onsets on the grid), then the downbeat among the 4 beats (strongest low band = kick on « 1 »).
  function grid(b, o, bpm) {
    var p = 60 * b.rate / bpm, bestPhase = 0, bestS = -1;
    for (var ph = 0; ph < p; ph += 0.5) { var s = 0; for (var x = ph; x < o.length - 1; x += p) s += at(o, x); if (s > bestS) { bestS = s; bestPhase = ph; } }
    var bestD = 0, bestL = -1, win = Math.max(2, Math.round(0.12 * b.rate));
    for (var d = 0; d < 4; d++) {
      var l = 0;
      // Rise of the low band (kick attack): a sustained bass line cancels out, the accented « 1 » stands out.
      for (var y = bestPhase + d * p; y < b.low.length - win; y += 4 * p) for (var w = -1; w < win; w++) l += Math.max(0, at(b.low, y + w + 1) - at(b.low, Math.max(0, y + w)));
      if (l > bestL) { bestL = l; bestD = d; }
    }
    var beat = 60 / bpm, first = (bestPhase + bestD * p) / b.rate;
    // Earliest downbeat of that phase, so bar 1 starts near the beginning of the track.
    return { bpm: bpm, beat: beat, bar: 4 * beat, firstBeat: bestPhase / b.rate, firstDownbeat: first - Math.floor(first / (4 * beat)) * 4 * beat };
  }
  function norm(list, key) { var sorted = list.map(function (x) { return x[key]; }).sort(function (a, b) { return a - b; }), top = sorted[Math.floor(sorted.length * 0.95)] || 1; return function (v) { return Math.min(1, v / (top || 1)); }; }
  function barFeatures(b, o, g, duration) {
    var bars = [];
    for (var t = g.firstDownbeat; t + g.bar <= duration + 1e-6; t += g.bar) {
      var f0 = Math.floor(t * b.rate), f1 = Math.min(b.full.length, Math.floor((t + g.bar) * b.rate));
      bars.push({ start: t, end: t + g.bar, full: mean(b.full, f0, f1), low: mean(b.low, f0, f1), high: mean(b.high, f0, f1), density: mean(o, f0, f1) });
    }
    if (!bars.length) return bars;
    var nf = norm(bars, 'full'), nl = norm(bars, 'low'), nh = norm(bars, 'high'), nd = norm(bars, 'density');
    bars.forEach(function (x) {
      x.vec = [nf(x.full), nl(x.low), nh(x.high), nd(x.density)];
      x.intensity = 0.4 * x.vec[0] + 0.25 * x.vec[1] + 0.2 * x.vec[2] + 0.15 * x.vec[3];
    });
    return bars;
  }
  function dist(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return Math.sqrt(s); }
  // Loopability: the bar before the start should resemble the last bar, and the bar after the end should resemble the first one.
  function seam(bars, s, L) {
    var d = [];
    if (s > 0) d.push(dist(bars[s - 1].vec, bars[s + L - 1].vec));
    if (s + L < bars.length) d.push(dist(bars[s].vec, bars[s + L].vec));
    return d.length ? Math.max(0, 1 - mean(d) / 1.2) : 0.5;
  }
  function candidates(bars) {
    var out = [], n = bars.length, lengths = n >= 16 ? [4, 8] : n >= 4 ? [2, 4] : [Math.max(1, n)];
    lengths.forEach(function (L) {
      for (var s = 0; s + L <= n; s++) {
        var I = [], k;
        for (k = s; k < s + L; k++) I.push(bars[k].intensity);
        var avg = mean(I), sd = Math.sqrt(mean(I.map(function (v) { return (v - avg) * (v - avg); }))), steady = Math.max(0, 1 - 2.5 * sd), sm = seam(bars, s, L);
        var xm = (L - 1) / 2, num = 0, den = 0;
        for (k = 0; k < L; k++) { num += (k - xm) * (I[k] - avg); den += (k - xm) * (k - xm); }
        var slope = den ? num / den * L : 0, next = s + L < n ? mean(bars.slice(s + L, Math.min(n, s + 2 * L)).map(function (x) { return x.intensity; })) : 0;
        var silent = mean(bars.slice(s, s + L).map(function (x) { return x.vec[0]; })) < 0.08, phrase = L >= 8 ? 0.03 : 0;
        out.push({ startBar: s, bars: L, start: bars[s].start, end: bars[s + L - 1].end, intensity: avg,
          rest: silent ? -1 : (1 - avg) * 0.55 + sm * 0.3 + steady * 0.15 + phrase,
          effort: avg * 0.6 + sm * 0.25 + steady * 0.15 + phrase,
          rise: Math.max(0, slope) * 0.5 + next * 0.3 + sm * 0.2 - (silent ? 1 : 0) });
      }
    });
    return out;
  }
  function pick(cands, role, count, taken) {
    var chosen = [], overlap = function (a, b) { return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start)) / Math.min(a.end - a.start, b.end - b.start); };
    cands.slice().sort(function (a, b) { return b[role] - a[role]; }).forEach(function (c) {
      if (chosen.length >= count || c[role] < 0) return;
      if (chosen.concat(taken || []).some(function (x) { return overlap(x, c) > 0.25; })) return;
      chosen.push(c);
    });
    return chosen.map(function (c) { return { role: role, start: c.start, end: c.end, bars: c.bars, startBar: c.startBar, intensity: c.intensity, score: c[role] }; });
  }
  // Full analysis of a mono signal. Returns the grid, per-bar intensity and the 3 best candidates per role.
  function analyze(data, sr) {
    var duration = data.length / sr, b = bands(data, sr), o = onsets(b), bpm = tempo(o, b.rate), g = grid(b, o, bpm), bars = barFeatures(b, o, g, duration);
    if (bars.length < 2) throw new Error('Morceau trop court pour l’analyse automatique.');
    var c = candidates(bars), effort = pick(c, 'effort', 3), rest = pick(c, 'rest', 3, effort.slice(0, 1)), rise = pick(c, 'rise', 3, effort.slice(0, 1).concat(rest.slice(0, 1)));
    return { bpm: Math.round(bpm * 10) / 10, beat: g.beat, bar: g.bar, firstBeat: g.firstBeat, firstDownbeat: g.firstDownbeat,
      bars: bars.map(function (x) { return { start: x.start, end: x.end, intensity: x.intensity }; }), suggestions: { rest: rest, rise: rise, effort: effort } };
  }
  return { analyze: analyze, bands: bands, onsets: onsets, tempo: tempo, grid: grid, barFeatures: barFeatures, candidates: candidates, HOP: HOP };
});
