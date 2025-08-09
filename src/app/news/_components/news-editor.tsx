
"use client"

import { useState, KeyboardEvent } from "react"
import { Wand2, Loader2, CheckCircle, Pencil, Save, Tags, X, Twitter, Instagram, Copy } from "lucide-react"
import { generateNewsArticle } from "@/ai/flows/generate-news-article"
import { suggestNewsTags } from "@/ai/flows/suggest-news-tags"
import { generateSocialPost } from "@/ai/flows/generate-social-post"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

interface NewsEditorProps {
  onPublish: (article: { headline: string; content: string; tags: string[] }) => void
}

interface SocialPosts {
  twitterPost: string;
  instagramPost: string;
}

export function NewsEditor({ onPublish }: NewsEditorProps) {
  const [bulletPoints, setBulletPoints] = useState("")
  const [articleContent, setArticleContent] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [socialPosts, setSocialPosts] = useState<SocialPosts | null>(null);

  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false)
  const [isSuggestingTags, setIsSuggestingTags] = useState(false)
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!bulletPoints.trim()) return
    setIsGeneratingArticle(true)
    setArticleContent("")
    setSuggestedTags([])
    setSocialPosts(null);
    setIsEditing(false)
    
    try {
      const result = await generateNewsArticle({ bulletPoints })
      setArticleContent(result.article)
      setIsEditing(true)
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
    setIsEditing(false)
    setSocialPosts(null)
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

  const handleGenerateSocial = async () => {
    if (!articleContent.trim()) return
    setIsGeneratingSocial(true)
    try {
        const result = await generateSocialPost({ articleContent, tags: suggestedTags });
        setSocialPosts(result);
    } catch (error) {
        console.error("Failed to generate social posts:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "There was an issue generating social posts. Please try again.",
        });
    } finally {
        setIsGeneratingSocial(false);
    }
  };

  const handlePublish = () => {
    const lines = articleContent.split('\n');
    const headline = lines.find(line => line.trim() !== '') || "Untitled Article"
    const content = lines.slice(lines.indexOf(headline) + 1).join('\n').trim();

    onPublish({ headline, content, tags: suggestedTags });
    
    // Reset fields
    setBulletPoints("");
    setArticleContent("");
    setSuggestedTags([]);
    setSocialPosts(null);
    setIsEditing(false);
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Post content copied to clipboard.",
    });
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !suggestedTags.includes(tagInput.trim())) {
      setSuggestedTags([...suggestedTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSuggestedTags(suggestedTags.filter(tag => tag !== tagToRemove));
  };

  const isLoading = isGeneratingArticle || isSuggestingTags || isGeneratingSocial;
  const showArticleEditor = isGeneratingArticle || articleContent;
  const showTagSection = isSuggestingTags || suggestedTags.length > 0;
  const showSocialSection = isGeneratingSocial || socialPosts;

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="bullet-points" className="font-semibold text-base">
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
         <div className="mt-4">
          <Button onClick={handleGenerate} disabled={isLoading || !bulletPoints.trim() || !!articleContent}>
            {isGeneratingArticle ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Generate Article
          </Button>
        </div>
      </div>
      
      {showArticleEditor && (
        <>
          <Separator />
          <div>
            <Label htmlFor="article-content" className="font-semibold text-base mt-6 mb-2 block">
              Step 2: Edit & Finalize Article
            </Label>
             <Card className="mt-2 border-none shadow-none bg-muted">
              <CardContent className="p-4">
                 {isGeneratingArticle ? (
                    <div className="flex items-center space-x-2 text-muted-foreground min-h-[250px]">
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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!isEditing && !isSuggestingTags && suggestedTags.length === 0 && (
                <Button onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Article
                </Button>
              )}
              {isEditing && (
                <Button onClick={handleSuggestTags} disabled={isSuggestingTags}>
                  {isSuggestingTags ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save and Suggest Tags
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {showTagSection && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold text-base mt-6 mb-2">Step 3: Add or Remove Tags</h3>
            {isSuggestingTags ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin"/>
                  <span>Suggesting tags...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 p-2 rounded-md bg-muted min-h-[40px] items-center">
                  {suggestedTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-sm py-1 pl-3 pr-2">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-2 rounded-full hover:bg-muted-foreground/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                   <Input
                    type="text"
                    placeholder="Add a custom tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                  />
                  <Button onClick={handleAddTag} variant="outline">Add Tag</Button>
                </div>
                 <div className="mt-4">
                  <Button onClick={handleGenerateSocial} disabled={isLoading}>
                    {isGeneratingSocial ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Generate Social Posts
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      
      {showSocialSection && (
        <>
           <Separator />
           <div>
              <h3 className="font-semibold text-base mt-6 mb-2">Step 4: Review Social Posts</h3>
              {isGeneratingSocial ? (
                 <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    <span>Generating social posts...</span>
                </div>
              ) : (
                <div className="space-y-4">
                    {/* Twitter */}
                    <div>
                        <Label className="flex items-center gap-2 mb-2"><Twitter className="h-5 w-5 text-[#1DA1F2]" /> Twitter Post</Label>
                        <Card className="bg-muted">
                            <CardContent className="p-3 relative">
                                <p className="text-sm whitespace-pre-wrap">{socialPosts?.twitterPost}</p>
                                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(socialPosts?.twitterPost || '')}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                    {/* Instagram */}
                     <div>
                        <Label className="flex items-center gap-2 mb-2"><Instagram className="h-5 w-5 text-[#E4405F]" /> Instagram Post</Label>
                        <Card className="bg-muted">
                            <CardContent className="p-3 relative">
                                <p className="text-sm whitespace-pre-wrap">{socialPosts?.instagramPost}</p>
                                 <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(socialPosts?.instagramPost || '')}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
              )}
           </div>
        </>
      )}

      {socialPosts && !isLoading && (
        <>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handlePublish} size="lg">
              <CheckCircle className="mr-2 h-5 w-5" />
              Publish Article
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
