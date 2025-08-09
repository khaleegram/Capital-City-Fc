import { MatchSummaryGenerator } from "./_components/match-summary-generator"

export default function SummariesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-headline font-bold">Intelligent Match Summaries</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Generate concise, engaging match summaries from raw text input. Paste post-match reports, transcripts, or notes to get started.
          </p>
        </div>
        <MatchSummaryGenerator />
      </div>
    </div>
  )
}
