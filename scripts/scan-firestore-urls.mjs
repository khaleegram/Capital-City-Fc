#!/usr/bin/env node
/** Read-only scan of Firestore for any stored URL pointing at an R2 host. */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const NEEDLES = ["r2.dev", "r2.cloudflarestorage.com", "pub-3432f7", "pub-b659f501"]

const { initializeApp, applicationDefault } = await import("firebase-admin/app")
const { getFirestore } = await import("firebase-admin/firestore")

const projectId = "capital-city-app"
initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()

const adc = join(homedir(), ".config", "gcloud", "application_default_credentials.json")
console.log(`project : ${projectId}`)
console.log(`ADC     : ${existsSync(adc) ? "present" : "absent"}\n`)

function hitsIn(value, path) {
  const out = []
  const walk = (v, p) => {
    if (typeof v === "string") {
      for (const n of NEEDLES) if (v.includes(n)) out.push({ path: p, value: v })
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`))
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`)
  }
  walk(value, path)
  return out
}

const collections = await db.listCollections()
console.log(`collections: ${collections.map((c) => c.id).join(", ")}\n`)

let total = 0
for (const col of collections) {
  const snap = await col.limit(500).get()
  for (const doc of snap.docs) {
    const hits = hitsIn(doc.data(), `${col.id}/${doc.id}`)
    for (const h of hits) {
      total++
      console.log(`HIT  ${h.path}\n     ${h.value}\n`)
    }
  }
  process.stdout.write(`scanned ${col.id}: ${snap.size} docs\n`)
}
console.log(`\n${total} stored URL(s) reference an R2 host.`)
