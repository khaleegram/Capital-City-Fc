import type { Metadata } from "next"
import { Suspense } from "react"
import { AdminProvider } from "@/hooks/use-admin"
import { AdminGuard } from "@/components/admin/admin-guard"
import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  title: "Staff console",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGuard>
        <AdminShell>
          <Suspense>{children}</Suspense>
        </AdminShell>
      </AdminGuard>
    </AdminProvider>
  )
}
