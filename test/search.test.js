// Run with:  node test/search.test.js
const { resolve } = require("../lib/search");

// [query, expected plan id to be sent (or offered first)]
const CASES = [
  ["pneumonia", "3.1"], ["PNEUMONIA", "3.1"], ["Pneumonia", "3.1"], ["pnemonia", "3.1"],
  ["pnuemonia", "3.1"], ["neumonia", "3.1"], ["pneumonia in children", "17.3"],
  ["MI", "4.4"], ["mi", "4.4"], ["myocardial infraction", "4.4"], ["heart attack", "4.4"],
  ["hart failur", "4.5"], ["CHF", "4.5"], ["COPD", "3.4"], ["copd", "3.4"],
  ["DKA", "8.3"], ["diabetic ketoacidosis", "8.3"], ["diabetic ketoasidosis", "8.3"],
  ["preoperative", "2.1"], ["pre op", "2.1"], ["Pre-Operative care", "2.1"], ["post operative", "2.2"],
  ["4.4", "4.4"], ["2-1", "2.1"], ["asthma", "3.2"], ["asthma in child", "17.4"],
  ["stroke", "5.1"], ["CVA", "5.1"], ["strok", "5.1"], ["guillain barre", "5.13"],
  ["guillain-barré syndrome", "5.13"], ["parkinsons", "5.16"], ["Parkinson's disease", "5.16"],
  ["anaemia", "10.1"], ["iron deficiency anaemia", "10.1"], ["haemophilia", "10.9"],
  ["caesarean section", "15.16"], ["c-section", "15.16"], ["cesarian", "15.16"],
  ["pre eclampsia", "15.7"], ["preeclampsia", "15.7"], ["eclampsia", "15.8"],
  ["brain tumor", "5.6"], ["brain tumour", "5.6"], ["dvt", "4.17"], ["deep vein thrombosis", "4.17"],
  ["bed sore", "2.7"], ["burns", "11.1"], ["sepsis", "14.2"], ["septic shok", "14.2"],
  ["schizophernia", "18.7"], ["schizophrenia", "18.7"], ["depression", "18.5"],
  ["hypoglycemia", "8.5"], ["hypoglycaemia", "8.5"], ["hypoglicemia", "8.5"],
  ["tracheostomy", "3.15"], ["trachiostomy", "3.15"], ["UTI", "7.1"],
  ["kidney stones", "7.4"], ["appendicitis", "6.9"], ["apendicitis", "6.9"],
  ["fever", "2.9"], ["Fever", "2.9"], ["FEVER", "2.9"], ["nausea and vomiting", "2.18"],
  ["Thalassemia", "10.3"], ["thalassemia major", "17.15"], ["neonatal jaundice", "16.3"],
  ["care plan for pneumonia", "3.1"], ["ncp of copd", "3.4"],
  ["السكري", "8.2"], ["الربو", "3.2"], ["ذات الرئة", "3.1"], ["الجلطة الدماغية", "5.1"],
  ["ارتفاع ضغط الدم", "4.1"], ["الولاده القيصريه", "15.16"],
  ["Cushings", "8.10"], ["addisons disease", "8.11"], ["crohns", "6.7"],
  ["status epilepticus", "5.8"], ["epilepsy", "5.7"], ["hip replacment", "9.6"],
  ["total knee replacement", "9.7"], ["TKR", "9.7"], ["ARDS", "3.12"], ["SIADH", "8.12"],
];

let pass = 0;
for (const [q, want] of CASES) {
  const r = resolve(q);
  const got = r.type === "send" ? r.plan.id : r.type === "choose" ? (r.options[0] || {}).id : "-";
  const ok = got === want;
  if (ok) pass++;
  const extra = r.type === "send" ? (r.related.length ? " +related " + r.related.map((p) => p.id).join(",") : "")
    : r.type === "choose" ? " options " + r.options.map((p) => p.id).join(",") : "";
  console.log(`${ok ? "PASS" : "FAIL"}  ${q.padEnd(28)} -> ${r.type} ${got}${extra}`);
}
console.log(`\n${pass}/${CASES.length} passed`);
for (const q of ["xyzzy", "banana"]) console.log(q, "->", resolve(q).type);
process.exit(pass === CASES.length ? 0 : 1);
