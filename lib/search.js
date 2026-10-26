// Topic search for the CPMN care plans.
// Handles any letter case, typos/misspellings, British/American spelling,
// abbreviations (MI, COPD, DKA ...), plan numbers ("4.4") and Arabic names.

const PLANS = require("../data/plans.json");

const STOP = new Set([
  "and", "of", "the", "in", "for", "with", "a", "an", "to", "on", "about", "at",
  "care", "plan", "plans", "ncp", "nursing", "nurse", "patient", "pdf", "page",
  "please", "pls", "send", "me", "give", "show", "want", "i", "need",
  // Arabic filler words (already normalised)
  "خطه", "رعايه", "تمريضيه", "تمريضي", "عن", "في", "من", "مريض", "ارسل", "اريد", "لل",
]);

function stem(t) {
  if (/[؀-ۿ]/.test(t)) {
    // Arabic: drop the definite article "ال" (and "وال"/"بال"/"لل")
    t = t.replace(/^(وال|بال|كال|فال|لل|ال)(?=..)/, "");
    return t;
  }
  if (t === "children" || t === "childhood") return "child";
  if (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
  return t;
}

function normalize(s) {
  s = String(s || "").toLowerCase();
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // é -> e, ₂ -> 2
  // Arabic letter variants and diacritics
  s = s.replace(/[ً-ْٰـ]/g, "")
       .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
       .replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  s = s.replace(/&/g, " and ").replace(/['’`]/g, "");
  // British -> American spelling, applied to both query and titles
  s = s.replace(/ae/g, "e").replace(/oe(?=[sd])/g, "e").replace(/oea/g, "ea")
       .replace(/our\b/g, "or").replace(/isation/g, "ization");
  s = s.replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
  return s;
}

function tokens(s) {
  return normalize(s).split(" ").filter(Boolean).map(stem).filter((t) => !STOP.has(t));
}

// Optimal string alignment distance (Levenshtein + adjacent transposition)
function osa(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function ratio(a, b) {
  if (!a.length || !b.length) return 0;
  return 1 - osa(a, b) / Math.max(a.length, b.length);
}

function tokSim(q, t) {
  if (q === t) return 1;
  if (q.length <= 2 || t.length <= 2) return 0;
  if (q.length >= 3 && t.startsWith(q)) return 0.85 + 0.1 * (q.length / t.length);
  if (t.length >= 4 && q.startsWith(t)) return 0.85;
  if (q.length <= 3) return 0;
  const r = ratio(q, t);
  return r >= 0.7 ? r : 0;
}

// Pre-compute candidate phrases for every plan
const INDEX = PLANS.map((p) => {
  const titleNoParen = p.title.replace(/\(.*?\)/g, " ");
  const paren = (p.title.match(/\((.*?)\)/) || [])[1];
  const phrases = [{ text: p.title, w: 1 }, { text: titleNoParen, w: 1 }];
  if (paren) phrases.push({ text: paren, w: 0.99 });
  for (const a of p.aliases || []) phrases.push({ text: a, w: 0.98 });
  return {
    plan: p,
    cands: phrases.map((ph) => {
      const toks = tokens(ph.text);
      return { w: ph.w, toks, compact: toks.join(""), raw: normalize(ph.text).replace(/ /g, "") };
    }).filter((c) => c.compact.length),
  };
});

function scoreCand(qToks, qCompact, qRaw, c) {
  if (qRaw === c.raw || qCompact === c.compact) return 1;
  // short abbreviations (MI, PE, CS ...) only match exactly
  if (c.compact.length <= 3 || qCompact.length <= 2) return 0;
  let best = 0;
  if (qCompact.length >= 4) {
    const r = ratio(qCompact, c.compact);
    if (r >= 0.75) best = r;
  }
  if (qToks.length) {
    const matched = new Set();
    let sum = 0;
    for (const q of qToks) {
      let b = 0, bi = -1;
      c.toks.forEach((t, i) => { const s = tokSim(q, t); if (s > b) { b = s; bi = i; } });
      if (bi >= 0 && b >= 0.7) matched.add(bi);
      sum += b;
    }
    const qCov = sum / qToks.length;
    const tCov = matched.size / c.toks.length;
    best = Math.max(best, qCov * (0.8 + 0.2 * tCov));
  }
  return best;
}

function search(query, limit = 8) {
  const q = String(query || "").trim();
  const idm = q.match(/^\s*(\d{1,2})\s*[.\-_ ]\s*(\d{1,2})\s*$/);
  if (idm) {
    const p = PLANS.find((x) => x.id === `${+idm[1]}.${+idm[2]}`);
    if (p) return [{ plan: p, score: 1.01 }];
  }
  const qToks = tokens(q);
  const qCompact = qToks.join("");
  const qRaw = normalize(q).replace(/ /g, "");
  if (!qRaw) return [];
  const results = INDEX.map((e) => {
    let s = 0;
    for (const c of e.cands) s = Math.max(s, scoreCand(qToks, qCompact, qRaw, c) * c.w);
    return { plan: e.plan, score: s };
  }).filter((r) => r.score > 0.4);
  results.sort((a, b) => b.score - a.score || a.plan.title.length - b.plan.title.length);
  return results.slice(0, limit);
}

// Decide what to do with a query:
//  { type: "send", plan, related: [plans] } | { type: "choose", options } | { type: "none" }
function resolve(query) {
  const r = search(query, 10);
  if (!r.length || r[0].score < 0.55) return { type: "none" };
  const top = r[0], second = r[1] ? r[1].score : 0;
  const confident = top.score >= 0.8 && (top.score - second >= 0.05 || (top.score >= 0.98 && second < 0.98));
  if (confident) {
    const related = r.slice(1).filter((x) => x.score >= Math.max(0.75, top.score - 0.16)).slice(0, 4).map((x) => x.plan);
    return { type: "send", plan: top.plan, related, score: top.score };
  }
  return { type: "choose", options: r.slice(0, 6).filter((x) => x.score >= 0.55).map((x) => x.plan) };
}

module.exports = { search, resolve, normalize, tokens, PLANS };
