"use client"

import { useState } from "react"
import { Loader2, Tags } from "lucide-react"
import { suggestNewsTags } from "@/ai/flows/suggest-news-tags"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export function TagSuggester() {
  const [articleContent, setArticleContent] = useState("")
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSuggest = async () => {
    if (!articleContent.trim()) return
    setIsLoading(true)
    setSuggestedTags([])
    try {
      const result = await suggestNewsTags({ articleContent })
      setSuggestedTags(result.tags)
    } catch (error) {
      console.error("Failed to suggest tags:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was an issue suggesting tags. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="article-content" className="font-semibold">
          Paste Article Content
        </Label>
        <Textarea
          id="article-content"
          placeholder="Paste the full content of your news article here..."
          value={articleContent}
          onChange={(e) => setArticleContent(e.target.value)}
          className="mt-2 min-h-[120px]"
          disabled={isLoading}
        />
      </div>
      <Button onClick={handleSuggest} disabled={isLoading || !articleContent.trim()}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Tags className="mr-2 h-4 w-4" />
        )}
        Suggest Tags
      </Button>
      {suggestedTags.length > 0 && (
        <div>
          <h3 className="font-headline text-lg font-semibold mt-6 mb-2">Suggested Tags</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
