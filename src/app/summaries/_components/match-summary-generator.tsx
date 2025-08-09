"use client"

import { useState } from "react"
import { generateMatchSummary } from "@/ai/flows/generate-match-summary"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function MatchSummaryGenerator() {
  const [bulletPoints, setBulletPoints] = useState("")
  const [summary, setSummary] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulletPoints.trim()) return
    setIsLoading(true)
    setSummary("")
    try {
      const result = await generateMatchSummary({ bulletPoints })
      setSummary(result.summary)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate summary. Please try again.",
      })
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
            <Label htmlFor="bullet-points" className="font-semibold">Match Bullet Points</Label>
            <Textarea
              id="bullet-points"
              value={bulletPoints}
              onChange={(e) => setBulletPoints(e.target.value)}
              placeholder="Enter key points from the match... e.g.&#10;- Final score: 2-1 vs Rivals United&#10;- Goalscorers: Leo Rivera (89'), Sofia Cruz (45')&#10;- Key moment: Alex Chen saved a penalty in the 60th minute."
              className="mt-2 min-h-[200px]"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !bulletPoints.trim()}>
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
