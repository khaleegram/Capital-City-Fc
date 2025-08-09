import { LiveUpdateForm } from "./_components/live-update-form"
import { LiveMatchFeed } from "./_components/live-match-feed"
import { Separator } from "@/components/ui/separator"

export default function SummariesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-headline font-bold">Live Match Updates</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Follow the action as it happens and post live updates from the admin panel.
          </p>
        </div>
        
        {/* Admin Component */}
        <LiveUpdateForm />

        <Separator className="my-12" />

        {/* Public Component */}
        <LiveMatchFeed />
      </div>
    </div>
  )
}
