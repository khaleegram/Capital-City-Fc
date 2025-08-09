"use client"

import { useState } from "react"
import { generateMatchSummary } from "@/ai/flows/generate-match-summary"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText } from "lucide-react"
import { Label } from "@/components/ui/label"

export function MatchSummaryGenerator() {
  const [rawText, setRawText] = useState("")
  const [summary, setSummary] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rawText.trim()) return
    setIsLoading(true)
    setSummary("")
    try {
      const result = await generateMatchSummary({ rawText })
      setSummary(result.summary)
    } catch (error) {
      console.error(error)
      setSummary("Failed to generate summary.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Summary Generator</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="raw-text" className="font-semibold">Raw Match Text</Label>
            <Textarea
              id="raw-text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw match text here... For example: 'Final whistle blows. Capital City 2, Rivals United 1. Leo Rivera scores in the 89th minute. Marco Jensen with the assist...'"
              className="mt-2 min-h-[200px]"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !rawText.trim()}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Generate Summary
          </Button>
        </form>

        {(isLoading || summary) && (
            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold font-headline">Generated Summary</h3>
                <Card className="mt-2 bg-muted">
                    <CardContent className="p-4">
                    {isLoading ? (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin"/>
                            <span>Generating summary...</span>
                        </div>
                    ) : (
                        <p className="text-sm font-body whitespace-pre-wrap">{summary}</p>
                    )}
                    </CardContent>
                </Card>
            </div>
        )}
      </CardContent>
    </Card>
  )
}
