"use client"

import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { TeamProfile } from "@/lib/data"
import { getTeamProfile, TEAM_PROFILE_DOC_ID } from "@/lib/team"
import { AdminPage, LoadingBlock } from "@/components/admin/ui"
import { TeamProfileForm } from "./_components/team-profile-form"
import { ProofStatsEditor } from "./_components/proof-stats-editor"
import { MaintenanceToggle } from "./_components/maintenance-toggle"
import { NotificationComposer } from "./_components/notification-composer"

export default function SettingsPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, "teamProfile", TEAM_PROFILE_DOC_ID),
        () => getTeamProfile().then(setProfile),
        () => getTeamProfile().then(setProfile)
      ),
    []
  )

  return (
    <AdminPage title="Settings & proof" description="Club profile, homepage numbers, maintenance mode and push notifications.">
      {!profile ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <ProofStatsEditor profile={profile} />
          <TeamProfileForm profile={profile} />
          <MaintenanceToggle profile={profile} />
          <NotificationComposer />
        </div>
      )}
    </AdminPage>
  )
}
