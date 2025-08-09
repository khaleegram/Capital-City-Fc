"use client"

import { useState } from "react"
import { Wand2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

export function NewsEditor() {
  const [bulletPoints, setBulletPoints] = useState("")
  const [generatedArticle, setGeneratedArticle] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = async () => {
    if (!bulletPoints.trim()) return
    setIsLoading(true)
    setGeneratedArticle("")
    // Mock AI call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const article = `**Capital City Secures Victory in a Thrilling Encounter**\n\nBased on the key points provided, Capital City FC has once again demonstrated their dominance on the field. The match, filled with tense moments and brilliant plays, ultimately tipped in our favor.\n\n${bulletPoints
      .split("\n")
      .map((point) => `- ${point.trim()}`)
      .join("\n")}\n\nThis result further solidifies the team's position in the league standings and gives the fans another reason to celebrate. The synergy between the players was palpable, leading to this well-deserved win.`
    setGeneratedArticle(article)
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="bullet-points" className="font-semibold">
          Enter Bullet Points
        </Label>
        <Textarea
          id="bullet-points"
          placeholder="e.g.&#10;- Final score 2-1&#10;- Leo Rivera scored the winning goal&#10;- Match was intense"
          value={bulletPoints}
          onChange={(e) => setBulletPoints(e.target.value)}
          className="mt-2 min-h-[120px]"
          disabled={isLoading}
        />
      </div>
      <Button onClick={handleGenerate} disabled={isLoading || !bulletPoints.trim()}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-4 w-4" />
        )}
        Generate Article
      </Button>
      {generatedArticle && (
        <div>
          <h3 className="font-headline text-lg font-semibold mt-6 mb-2">Generated Article</h3>
          <Card>
            <CardContent className="p-4">
              <pre className="whitespace-pre-wrap font-body text-sm">{generatedArticle}</pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
