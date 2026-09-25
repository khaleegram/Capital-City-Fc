#!/usr/bin/env node
/**
 * Regression test for the public `players` CREATE rule.
 *
 * RUN THIS BEFORE EVERY `firestore:rules` DEPLOY. The rule and
 * `src/lib/player-signup.ts` must always move together: Firestore rules cannot be
 * caught, so a guard that merely *errors* denies the write and the player is told
 * "something went wrong" with no clue why. That has shipped twice already —
 * `careerHighlights` being validated when optional, and the `signupGallery[0]`
 * out-of-range guard that rejected every photo-only submission.
 *
 * What it does:
 *   1. Parses `src/lib/player-signup.ts` and asserts the payload built here still
 *      matches the keys that file writes. Add a field there and this fails loudly,
 *      so the rule can't silently drift from the payload again.
 *   2. Runs the accept/reject matrix through the real Firestore client SDK with NO
 *      auth and `serverTimestamp()` for createdAt/updatedAt — the exact path a player
 *      takes in production. Not the REST API, which would not satisfy
 *      `createdAt == request.time`.
 *   3. Deletes every document it creates and asserts the collection is back to its
 *      expected size, so it is safe to run against production.
 *
 * Needs gcloud ADC for the cleanup/count step (firebase-admin); the writes themselves
 * deliberately use only the public NEXT_PUBLIC_FIREBASE_* config.
 *
 * After deploying rules, wait ~30 seconds before running this. Firestore propagates a rules
 * release asynchronously and a too-early run silently tests the PREVIOUS revision — that has
 * already produced one false "over-the-bound array was accepted" result.
 *
 * Exits non-zero on any mismatch between expected and actual.
 *
 * Usage: npm run verify:join-rule
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
process.loadEnvFile(join(ROOT, ".env.local"))

const { initializeApp } = await import("firebase/app")
const { addDoc, collection, getFirestore, serverTimestamp } = await import("firebase/firestore")
const { initializeApp: adminInit, applicationDefault } = await import("firebase-admin/app")
const { getFirestore: adminGetFirestore } = await import("firebase-admin/firestore")

/** Player docs that legitimately exist in production. The run fails if this changes. */
const EXPECTED_PLAYER_COUNT = 6

// ───────────────────────────── drift guard ─────────────────────────────

const SIGNUP_SRC = readFileSync(join(ROOT, "src/lib/player-signup.ts"), "utf8")

/** Pulls the keys written by the `clean({ ... })` block at a given indentation. */
function keysAtIndent(src, indent) {
  const re = new RegExp(`^ {${indent}}([A-Za-z_][A-Za-z0-9_]*):`, "gm")
  return new Set([...src.matchAll(re)].map((m) => m[1]))
}

function assertSameKeys(label, expected, actual) {
  const missing = [...expected].filter((k) => !actual.has(k))
  const extra = [...actual].filter((k) => !expected.has(k))
  if (missing.length || extra.length) {
    console.error(`\n✘ DRIFT in ${label}`)
    if (missing.length) console.error(`   in player-signup.ts but not in this test: ${missing.join(", ")}`)
    if (extra.length) console.error(`   in this test but not in player-signup.ts: ${extra.join(", ")}`)
    console.error(`   Update this test and firestore.rules together.`)
    process.exit(1)
  }
  console.log(`✔ ${label}: ${expected.size} keys in sync with player-signup.ts`)
}

// ─────────────────────── payload: mirrors player-signup.ts ───────────────────────

/** Verbatim from src/lib/collections.ts — strips `undefined` deeply; FieldValue sentinels survive. */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = clean(v)
    return out
  }
  return value
}

/** Verbatim from src/lib/player-signup.ts. */
function optional(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Field-for-field copy of submitPlayerSignup(). Returns the doc plus the key sets it wrote. */
function buildPayload(input) {
  const allFiles = [input.photo, ...input.gallery, ...input.videos]

  const clubHistory = input.clubHistory
    .filter((entry) => entry.club.trim().length > 0)
    .map((entry) =>
      clean({
        club: entry.club.trim(),
        league: optional(entry.league),
        division: optional(entry.division),
        country: optional(entry.country),
        seasons: optional(entry.seasons),
        current: !!entry.current,
        level: entry.level,
        appearances: entry.appearances,
        goals: entry.goals,
        assists: entry.assists,
        position: entry.position,
        verified: false,
      })
    )

  const current = clubHistory.find((entry) => entry.current)

  const doc = clean({
    name: input.name.trim(),
    nickname: optional(input.nickname),
    position: input.position,
    role: "Player",
    jerseyNumber: input.jerseyNumber,
    imageUrl: input.photo.url,
    bio: input.bio.trim(),
    stats: { appearances: 0, goals: 0, assists: 0 },
    strongFoot: input.strongFoot,
    careerHighlights: input.careerHighlights,
    squadStatus: "current",
    dob: input.dob,
    heightCm: input.heightCm,
    nationality: input.nationality.trim(),
    strengths: input.strengths,
    readyForNextStep: false,
    currentClub: current?.club,
    clubHistory: clubHistory.length ? clubHistory : undefined,
    signupSessionId: input.sessionId,
    signupGallery: input.gallery.map((f) => ({ url: f.url, bytes: f.bytes })),
    signupVideos: input.videos.map((f) => ({ url: f.url, bytes: f.bytes, name: f.name })),
    storageBytes: allFiles.reduce((sum, f) => sum + f.bytes, 0),
    source: "signup",
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return { doc, clubHistoryKeys: new Set(Object.keys(clubHistory[0] ?? {})) }
}

// ───────────────────────────── fixtures ─────────────────────────────

const BASE = String(process.env.R2_PUBLIC_URL || "https://cdn.example.com").replace(/\/$/, "")
const SESSION = crypto.randomUUID()
const file = (kind, name, bytes) => ({
  url: `${BASE}/signups/${SESSION}/${kind}/${crypto.randomUUID()}-${name}`,
  bytes,
  name,
  kind,
})

const photo = file("photo", "portrait.webp", 184_320)
const gallery = [file("gallery", "action-1.webp", 402_100), file("gallery", "action-2.webp", 388_450)]
const videos = [file("video", "clip-1.mp4", 5_242_880)]

/** Every optional field filled — what a player who types everything produces. */
const denseEntry = {
  club: "Kaduna United",
  league: "Nigeria Premier Football League",
  division: "Division One",
  country: "Nigeria",
  seasons: "2023/24",
  current: true,
  level: "Senior",
  appearances: 24,
  goals: 7,
  assists: 5,
  position: "Forward",
}

/** Only the club name typed — all three written keys still present. */
const sparseEntry = { club: "Rangers International Academy" }

const baseInput = () => ({
  name: "Rule Regression Probe",
  nickname: "Probe",
  dob: "2003-04-11",
  nationality: "Nigeria",
  position: "Forward",
  strongFoot: "Right",
  heightCm: 178,
  jerseyNumber: 17,
  bio: "A full-fidelity probe submission used to confirm the deployed create rule accepts a real player sign-up.",
  strengths: ["Pace", "Finishing"],
  careerHighlights: ["State cup winner 2024"],
  clubHistory: [denseEntry, sparseEntry],
  sessionId: SESSION,
  photo,
  gallery,
  videos,
})

// ───────────────────────────── runner ─────────────────────────────

const db = getFirestore(
  initializeApp(
    {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    "verify-join-rule"
  )
)

const created = []
const results = []

/** Writes `doc` unauthenticated. Retries only transport noise; a rules denial is final. */
async function attemptWrite(doc) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const ref = await addDoc(collection(db, "players"), doc)
      return { accepted: true, id: ref.id }
    } catch (e) {
      const code = e.code || e.message
      if (code === "permission-denied" || code === "invalid-argument") return { accepted: false, code }
      if (attempt === 6) return { accepted: null, code }
      await new Promise((r) => setTimeout(r, 1200))
    }
  }
  return { accepted: null, code: "exhausted" }
}

async function check(label, expectAccept, mutate) {
  const { doc } = buildPayload(baseInput())
  if (mutate) mutate(doc)

  const { accepted, id, code } = await attemptWrite(doc)
  if (accepted) created.push({ id, label })

  const pass = accepted === expectAccept
  results.push({ label, expectAccept, accepted, code, pass })

  const mark = accepted === null ? "??" : pass ? "✔" : "✘"
  const want = expectAccept ? "accept" : "reject"
  const got = accepted === null ? `inconclusive (${code})` : accepted ? "accepted" : `rejected (${code})`
  console.log(`${mark}  ${label.padEnd(62)} want ${want.padEnd(6)} got ${got}`)
}

// ───────────────────────────── the matrix ─────────────────────────────

console.log(`R2 public base : ${BASE}`)
console.log(`sessionId      : ${SESSION}\n`)

console.log("── drift guard ──")
{
  const { clubHistoryKeys } = buildPayload(baseInput())
  assertSameKeys("payload top-level keys", keysAtIndent(SIGNUP_SRC, 6), new Set(Object.keys(buildPayload(baseInput()).doc)))
  assertSameKeys("clubHistory entry keys", keysAtIndent(SIGNUP_SRC, 8), clubHistoryKeys)
}

console.log("\n── positive: MUST be accepted ──")
await check("P1  full fidelity: photo + 2 gallery + 1 video + [dense, sparse]", true, null)
await check("P2  photo only: no gallery, no videos, no clubs (the common first case)", true, (p) => {
  p.signupGallery = []
  p.signupVideos = []
  p.storageBytes = photo.bytes
  delete p.clubHistory
  delete p.currentClub
  delete p.nickname
  p.careerHighlights = []
})
await check("P3  gallery only: videos = []", true, (p) => {
  p.signupVideos = []
})
await check("P4  video only: gallery = []", true, (p) => {
  p.signupGallery = []
})
await check("P5  gallery + video, no club history", true, (p) => {
  delete p.clubHistory
  delete p.currentClub
})
await check("P6  five club entries (the array maximum)", true, (p) => {
  while (p.clubHistory.length < 5) p.clubHistory.push({ club: `Club ${p.clubHistory.length}`, current: false, verified: false })
})
await check("P7  five club entries, all fully dense", true, (p) => {
  p.clubHistory = Array.from({ length: 5 }, (_, i) => ({
    club: `Dense Club ${i}`,
    league: "Nigeria Premier Football League",
    division: "Division One",
    country: "Nigeria",
    seasons: "2023/24",
    current: i === 0,
    level: "Senior",
    appearances: 24,
    goals: 7,
    assists: 5,
    position: "Forward",
    verified: false,
  }))
})
await check("P8  optional fields omitted entirely (no nickname/highlights/currentClub)", true, (p) => {
  delete p.nickname
  delete p.careerHighlights
  delete p.currentClub
})
await check("P9  three club entries", true, (p) => {
  while (p.clubHistory.length < 3) p.clubHistory.push({ club: `Club ${p.clubHistory.length}`, current: false, verified: false })
})

console.log("\n── negative: MUST be rejected ──")
await check("N1  published: true", false, (p) => { p.published = true })
await check("N2  source: 'manual'", false, (p) => { p.source = "manual" })
await check("N3  clubHistory[0].verified = true", false, (p) => { p.clubHistory[0].verified = true })
await check("N4  clubHistory[1].verified = true (sparse, middle index)", false, (p) => { p.clubHistory[1].verified = true })
await check("N5  clubHistory[4].verified = true (last valid index)", false, (p) => {
  while (p.clubHistory.length < 5) p.clubHistory.push({ club: `Club ${p.clubHistory.length}`, current: false, verified: false })
  p.clubHistory[4].verified = true
})
await check("N6  six club entries (one over the bound)", false, (p) => {
  while (p.clubHistory.length < 6) p.clubHistory.push({ club: `Club ${p.clubHistory.length}`, current: false, verified: false })
})
await check("N7  nine club entries", false, (p) => {
  while (p.clubHistory.length < 9) p.clubHistory.push({ club: `Club ${p.clubHistory.length}`, current: false, verified: false })
})
await check("N8  stats.goals = 3", false, (p) => { p.stats = { appearances: 0, goals: 3, assists: 0 } })
await check("N9  dob missing", false, (p) => { delete p.dob })
await check("N10 imageUrl missing", false, (p) => { delete p.imageUrl })
await check("N11 imageUrl = '' (empty)", false, (p) => { p.imageUrl = "" })
await check("N12 imageUrl outside this session's staging prefix", false, (p) => { p.imageUrl = `${BASE}/players/someone-else.webp` })
await check("N13 clubHistory[1] missing the 'verified' key", false, (p) => { delete p.clubHistory[1].verified })
await check("N14 role: 'Coach'", false, (p) => { p.role = "Coach" })
await check("N15 clubHistory[0].club over 80 characters", false, (p) => { p.clubHistory[0].club = "x".repeat(81) })
await check("N16 clubHistory[0].level not a valid level", false, (p) => { p.clubHistory[0].level = "Professional" })
await check("N17 clubHistory[0].appearances = -1", false, (p) => { p.clubHistory[0].appearances = -1 })

// ── Known looseness — recorded, not asserted ─────────────────────────────────────────────
// Indices 1..4 get only `verified == false`; the rules evaluation budget does not allow full
// validClubEntry on every entry (see firestore.rules). These probe what that leaves open so
// the gap is visible and its closure can never go unnoticed. They do NOT fail the run.
console.log("\n── known looseness (characterisation, does not fail the run) ──")
const looseness = []
async function probeLooseness(label, mutate) {
  const { doc } = buildPayload(baseInput())
  mutate(doc)
  const { accepted, id, code } = await attemptWrite(doc)
  if (accepted) created.push({ id, label })
  looseness.push({ label, accepted })
  console.log(`   ${accepted ? "accepted" : `rejected (${code})`}  ${label}`)
}
await probeLooseness("5,000-character clubHistory[1].club is accepted (expected while unvalidated)", (p) => { p.clubHistory[1].club = "x".repeat(5000) })
await probeLooseness("clubHistory[1].club = 12345 (wrong type) accepted", (p) => { p.clubHistory[1].club = 12345 })
await probeLooseness("clubHistory[1].level = 'Professional' (non-enum) accepted", (p) => { p.clubHistory[1].level = "Professional" })

// ───────────────────────────── cleanup ─────────────────────────────

const admin = adminInit(
  { credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  "verify-join-rule-admin"
)
const adb = adminGetFirestore(admin)

console.log(`\n── cleanup (firebase-admin) ──`)
let cleanupFailures = 0
try {
  const before = await adb.collection("players").get()
  console.log(`players before cleanup: ${before.size}`)

  for (const { id, label } of created) {
    const snap = await adb.collection("players").doc(id).get()
    if (snap.exists) await adb.collection("players").doc(id).delete()
    else console.log(`  note: ${id} was not written after all (${label})`)
  }

  for (const { id, label } of created) {
    const snap = await adb.collection("players").doc(id).get()
    if (snap.exists) {
      cleanupFailures++
      console.error(`  ✘ STILL PRESENT ${id} (${label})`)
    }
  }
} catch (err) {
  cleanupFailures++
  console.error(`  ✘ cleanup failed: ${err.message}`)
}

let finalCount = null
try {
  const after = await adb.collection("players").get()
  finalCount = after.size
  console.log(`players after cleanup: ${after.size}`)
} catch (err) {
  console.error(`  ✘ could not recount: ${err.message}`)
}

// ───────────────────────────── verdict ─────────────────────────────

console.log("\n── summary ──")
const mismatches = results.filter((r) => !r.pass)
for (const r of mismatches) {
  console.log(
    `   MISMATCH  ${r.label}\n             expected ${r.expectAccept ? "accept" : "reject"}, got ${
      r.accepted === null ? `inconclusive (${r.code})` : r.accepted ? "accept" : `reject (${r.code})`
    }`
  )
}

const countOk = finalCount === EXPECTED_PLAYER_COUNT
console.log(`\ncases: ${results.length}   mismatches: ${mismatches.length}   cleanup failures: ${cleanupFailures}`)
console.log(`player docs: ${finalCount} (expected ${EXPECTED_PLAYER_COUNT}) ${countOk ? "✔" : "✘"}`)

const ok = mismatches.length === 0 && cleanupFailures === 0 && countOk
console.log(ok ? "\n✔ create rule matches player-signup.ts — safe to deploy" : "\n✘ FAILED — do not deploy")
process.exit(ok ? 0 : 1)
