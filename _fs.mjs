import { readFileSync } from "node:fs"
const env = {}
for (const l of readFileSync(".env.local","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,"") }
const { initializeApp, applicationDefault } = await import("firebase-admin/app")
const { getFirestore } = await import("firebase-admin/firestore")
const app = initializeApp({ credential: applicationDefault(), projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
const db = getFirestore(app)
const snap = await db.collection("players").limit(10).get()
console.log(`  Firestore READ ok — ${snap.size} player docs\n`)
for (const d of snap.docs) {
  const p = d.data()
  const u = p.imageUrl || ""
  let host = "—"
  if (u.includes("r2.dev")) host = "R2"
  else if (u.includes("firebasestorage")) host = "FIREBASE"
  else if (u) host = "other"
  console.log(`  ${String(p.name||"?").slice(0,26).padEnd(28)} ${host.padEnd(9)} ${u.split("/").pop()?.slice(0,42) || ""}`)
}
