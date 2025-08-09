
import { PlayerInsights } from "./_components/player-insights"

export default function ScoutingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-headline font-bold">Personalized Player Insights</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Leverage our Retrieval-Augmented Generation (RAG) tool to get detailed, well-reasoned answers to your questions about players.
          </p>
        </div>
        <PlayerInsights />
      </div>
    </div>
  )
}
