
"use client"

import { useState } from "react"
import { Wand2, Loader2, CheckCircle, Pencil, Save, Tags } from "lucide-react"
import { generateNewsArticle } from "@/ai/flows/generate-news-article"
import { suggestNewsTags } from "@/ai/flows/suggest-news-tags"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface NewsEditorProps {
  onPublish: (article: { headline: string; content: string; tags: string[] }) => void
}

export function NewsEditor({ onPublish }: NewsEditorProps) {
  const [bulletPoints, setBulletPoints] = useState("")
  const [articleContent, setArticleContent] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false)
  const [isSuggestingTags, setIsSuggestingTags] = useState(false)
  
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!bulletPoints.trim()) return
    setIsGeneratingArticle(true)
    setArticleContent("")
    setSuggestedTags([])
    setIsEditing(false)
    
    try {
      const result = await generateNewsArticle({ bulletPoints })
      setArticleContent(result.article)
      setIsEditing(true) // Automatically enter edit mode
    } catch (error) {
      console.error("Failed to generate article:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was an issue generating the article. Please try again.",
      })
    } finally {
      setIsGeneratingArticle(false)
    }
  }

  const handleSuggestTags = async () => {
    if (!articleContent.trim()) return
    setIsSuggestingTags(true)
    setSuggestedTags([])
    setIsEditing(false) // Lock editing while suggesting tags
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
      setIsSuggestingTags(false)
    }
  }

  const handlePublish = () => {
    const lines = articleContent.split('\n');
    const headline = lines[0] || "Untitled Article";
    const content = lines.slice(1).join('\n').trim();

    onPublish({ headline, content, tags: suggestedTags });
    
    toast({
      title: "Success!",
      description: "Your article has been published.",
      className: "bg-green-500 text-white",
    })

    // Reset fields
    setBulletPoints("");
    setArticleContent("");
    setSuggestedTags([]);
    setIsEditing(false);
  }

  const isLoading = isGeneratingArticle || isSuggestingTags;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="bullet-points" className="font-semibold">
          Step 1: Enter Bullet Points
        </Label>
        <Textarea
          id="bullet-points"
          placeholder="e.g.&#10;- Final score 2-1&#10;- Leo Rivera scored the winning goal&#10;- Match was intense"
          value={bulletPoints}
          onChange={(e) => setBulletPoints(e.target.value)}
          className="mt-2 min-h-[120px]"
          disabled={isLoading || !!articleContent}
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={isLoading || !bulletPoints.trim() || !!articleContent}>
          {isGeneratingArticle ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Article
        </Button>
        
        {articleContent && !isEditing && !isSuggestingTags && suggestedTags.length === 0 && (
          <Button onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Article
          </Button>
        )}
        
        {articleContent && isEditing && (
          <Button onClick={handleSuggestTags} disabled={isSuggestingTags}>
            {isSuggestingTags ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Tags className="mr-2 h-4 w-4" />
            )}
            Save and Suggest Tags
          </Button>
        )}

        {suggestedTags.length > 0 && !isLoading && (
          <Button onClick={handlePublish}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Publish
          </Button>
        )}
      </div>

      {(isGeneratingArticle || articleContent) && (
        <div>
          <Label htmlFor="article-content" className="font-semibold mt-6 mb-2 block">
            Step 2: Edit & Finalize Article
          </Label>
           <Card className="mt-2 bg-muted">
            <CardContent className="p-4">
               {isGeneratingArticle ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin"/>
                      <span>Generating article...</span>
                  </div>
              ) : (
                <Textarea
                  id="article-content"
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  readOnly={!isEditing || isSuggestingTags}
                  className="min-h-[250px] bg-background"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {(isSuggestingTags || suggestedTags.length > 0) && (
         <div>
          <h3 className="font-headline text-lg font-semibold mt-6 mb-2">Step 3: Suggested Tags</h3>
           {isSuggestingTags ? (
             <div className="flex items-center space-x-2 text-muted-foreground">
                 <Loader2 className="h-4 w-4 animate-spin"/>
                 <span>Suggesting tags...</span>
             </div>
           ) : (
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
           )}
        </div>
      )}
    </div>
  )
}
