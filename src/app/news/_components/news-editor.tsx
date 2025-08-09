"use client"

import { useState } from "react"
import { Wand2, Loader2 } from "lucide-react"
import { generateNewsArticle } from "@/ai/flows/generate-news-article"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

export function NewsEditor() {
  const [bulletPoints, setBulletPoints] = useState("")
  const [generatedArticle, setGeneratedArticle] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!bulletPoints.trim()) return
    setIsLoading(true)
    setGeneratedArticle("")
    
    try {
      const result = await generateNewsArticle({ bulletPoints })
      setGeneratedArticle(result.article)
    } catch (error) {
      console.error("Failed to generate article:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was an issue generating the article. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
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
      {(isLoading || generatedArticle) && (
        <div>
          <h3 className="font-headline text-lg font-semibold mt-6 mb-2">Generated Article</h3>
           <Card className="mt-2 bg-muted">
            <CardContent className="p-4">
               {isLoading ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin"/>
                      <span>Generating article...</span>
                  </div>
              ) : (
                <pre className="whitespace-pre-wrap font-body text-sm">{generatedArticle}</pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
