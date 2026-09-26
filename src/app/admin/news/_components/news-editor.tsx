
"use client"

import { useState, KeyboardEvent, useEffect } from "react"
import { Wand2, Loader2, CheckCircle, Pencil, Save, Tags, X, Twitter, Instagram, Copy, UploadCloud, ArrowLeft, ArrowRight, Trash2 } from "lucide-react"
import { generateNewsArticle } from "@/ai/flows/generate-news-article"
import { suggestNewsTags } from "@/ai/flows/suggest-news-tags"
import { generateSocialPost } from "@/ai/flows/generate-social-post"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Field } from "@/components/admin/ui"
import { NativeSelect } from "@/components/admin/form-kit"
import { useCollection } from "@/lib/collections"
import { toDate } from "@/lib/utils"
import type { ArticlePhotoInput } from "@/lib/news"
import type { Fixture, NewsArticle } from "@/lib/data"

interface NewsEditorProps {
  onPublish: (article: { headline: string; content: string; tags: string[]; imageFile: File | null; heroImageFile: File | null; heroImageMobileFile: File | null; clearHeroImage: boolean; clearHeroImageMobile: boolean; photos: ArticlePhotoInput[]; fixtureId?: string | null }, articleId?: string) => Promise<void>;
  articleToEdit?: NewsArticle | null;
  onFinishEditing: () => void;
}

/**
 * A photo in the editor's list.
 *
 * `url` is set for one already saved on the article and `file`/`preview` for one picked in this
 * session; exactly one of the two is present. `key` identifies the row while it has no URL yet.
 */
type PhotoDraft = { key: string; caption: string; url?: string; file?: File; preview?: string };

/** Existing photos as editor rows, so opening an article shows what it already has. */
const photosToDrafts = (article: NewsArticle | null | undefined): PhotoDraft[] =>
  (article?.photos ?? []).map((p) => ({ key: p.url, caption: p.caption ?? "", url: p.url, preview: p.url }));

let photoKeySeed = 0;
const nextPhotoKey = () => `new-${++photoKeySeed}`;

interface SocialPosts {
  twitterPost: string;
  instagramPost: string;
}

export function NewsEditor({ onPublish, articleToEdit, onFinishEditing }: NewsEditorProps) {
  const [headline, setHeadline] = useState("");
  const [bulletPoints, setBulletPoints] = useState("")
  const [articleContent, setArticleContent] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [socialPosts, setSocialPosts] = useState<SocialPosts | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [clearHeroImage, setClearHeroImage] = useState(false);
  const [mobileHeroPreview, setMobileHeroPreview] = useState<string | null>(null);
  const [mobileHeroImageFile, setMobileHeroImageFile] = useState<File | null>(null);
  const [clearMobileHeroImage, setClearMobileHeroImage] = useState(false);
  /*
   * Extra photos, held as one ordered list of existing and newly-picked entries so the order the
   * writer sees is the order that gets saved. Each carries a stable `key` because a photo being
   * uploaded has no URL yet to identify it by.
   */
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);


  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false)
  const [isSuggestingTags, setIsSuggestingTags] = useState(false)
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** The match this article reports on, if any. See the Fixture field below. */
  const [fixtureId, setFixtureId] = useState<string | null>(null);

  const { items: fixtures, loading: fixturesLoading } = useCollection<Fixture>("fixtures", (a, b) => {
    // Most recent first, so the match just played is at the top of the list.
    return (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0)
  })

  const { toast } = useToast()

  useEffect(() => {
    if (articleToEdit) {
      setHeadline(articleToEdit.headline);
      setArticleContent(articleToEdit.content);
      setSuggestedTags(articleToEdit.tags || []);
      setFixtureId(articleToEdit.fixtureId ?? null);
      setImagePreview(articleToEdit.imageUrl);
      setImageFile(null);
      setHeroPreview(articleToEdit.heroImageUrl || null);
      setHeroImageFile(null);
      setClearHeroImage(false);
      setMobileHeroPreview(articleToEdit.heroImageMobileUrl || null);
      setMobileHeroImageFile(null);
      setClearMobileHeroImage(false);
      setPhotos(photosToDrafts(articleToEdit));
      setBulletPoints("");
      setIsEditing(true);
      setSocialPosts(null);
    } else {
       resetForm();
    }
  }, [articleToEdit])

  const resetForm = () => {
    setHeadline("");
    setBulletPoints("");
    setArticleContent("");
    setSuggestedTags([]);
    setSocialPosts(null);
    setFixtureId(null);
    setImagePreview(null);
    setImageFile(null);
    setHeroPreview(null);
    setHeroImageFile(null);
    setClearHeroImage(false);
    setMobileHeroPreview(null);
    setMobileHeroImageFile(null);
    setClearMobileHeroImage(false);
    setPhotos([]);
    setIsEditing(false);
    onFinishEditing();
  }

  const handleGenerate = async () => {
    if (!bulletPoints.trim()) return
    setIsGeneratingArticle(true)
    setArticleContent("")
    setSuggestedTags([])
    setSocialPosts(null);
    setImagePreview(null);
    setImageFile(null);
    setIsEditing(false)
    
    try {
      const result = await generateNewsArticle({ bulletPoints })
      const lines = result.article.split('\n');
      const generatedHeadline = lines.find(line => line.trim() !== '') || "Untitled Article";
      const generatedContent = lines.slice(lines.indexOf(generatedHeadline) + 1).join('\n').trim();
      
      setHeadline(generatedHeadline);
      setArticleContent(generatedContent);
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
    setImagePreview(null);
    setImageFile(null);
    try {
      const result = await suggestNewsTags({ articleContent: `${headline}\n${articleContent}` })
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

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      setClearHeroImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeroPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveHero = () => {
    setHeroPreview(null);
    setHeroImageFile(null);
    setClearHeroImage(true);
  };

  const handleMobileHeroFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMobileHeroImageFile(file);
      setClearMobileHeroImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMobileHeroPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMobileHero = () => {
    setMobileHeroPreview(null);
    setMobileHeroImageFile(null);
    setClearMobileHeroImage(true);
  };

  /**
   * Adds every file picked in one go.
   *
   * `multiple` on the input means a writer can select a whole set from their camera roll at once,
   * which is the whole point of the field — doing this one file at a time is what they were
   * already working around.
   */
  const handlePhotoFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const added = files.map((file) => ({
      key: nextPhotoKey(),
      caption: "",
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((current) => [...current, ...added]);
    // Cleared so picking the same file again still fires a change event.
    e.target.value = "";
  };

  const handleRemovePhoto = (key: string) => setPhotos((current) => current.filter((p) => p.key !== key));

  const handlePhotoCaption = (key: string, caption: string) =>
    setPhotos((current) => current.map((p) => (p.key === key ? { ...p, caption } : p)));

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      ;[next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleGenerateSocial = async () => {
    if (!articleContent.trim()) return
    setIsGeneratingSocial(true)
    try {
        const result = await generateSocialPost({ articleContent: `${headline}\n${articleContent}`, tags: suggestedTags });
        setSocialPosts(result);
    } catch (error) {
        console.error("Failed to generate social posts:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "There was an issue generating social posts.",
        });
    } finally {
        setIsGeneratingSocial(false);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    await onPublish({
      headline,
      content: articleContent,
      tags: suggestedTags,
      imageFile,
      heroImageFile,
      heroImageMobileFile: mobileHeroImageFile,
      clearHeroImage,
      clearHeroImageMobile: clearMobileHeroImage,
      // `url` for photos already saved, `file` for ones picked now — the library uploads the latter.
      photos: photos.map(({ url, file, caption }) => ({ url, file, caption })),
      fixtureId,
    }, articleToEdit?.id);
    setIsSubmitting(false);
    resetForm();
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

  const isLoading = isGeneratingArticle || isSuggestingTags || isGeneratingSocial || isSubmitting;
  const isCreatingNew = !articleToEdit;

  const showStep1 = isCreatingNew;
  const showStep2 = isGeneratingArticle || articleContent || articleToEdit;
  const showStep3 = isSuggestingTags || suggestedTags.length > 0;
  const showStep4 = showStep3 && !isSuggestingTags;
  const showStep5 = (isGeneratingSocial || socialPosts) && !isSuggestingTags;


  return (
    <div className="space-y-6">
      {isCreatingNew && (
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
              {isGeneratingArticle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Article
            </Button>
          </div>
        </div>
      )}
      
      {showStep2 && (
        <>
          <Separator />
          <div>
            <Label className="font-semibold text-base mt-6 mb-2 block">
              {isCreatingNew ? 'Step 2' : 'Step 1'}: Edit & Finalize Article
            </Label>
            <div className="space-y-4">
              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={isLoading || !isEditing}/>
              </div>
              <div>
                <Label htmlFor="article-content">Content</Label>
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
                        readOnly={!isEditing || isLoading}
                        className="min-h-[250px] bg-background"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
              {/*
                * The link to a match.
                *
                * Match reports are drafted automatically now, so this exists for the other
                * direction: a person writing about a match they already know the result of, or
                * writing up a game by hand instead of accepting the draft. Linking the article
                * to its fixture is what makes the two agree — the match hub adopts this article
                * rather than drafting a second one beside it, and the fixture takes the report
                * with it if it is ever deleted.
                */}
              <Field
                label="Match"
                hint="Link this report to a fixture. Leave it as Not linked for news that isn't about a match."
              >
                <NativeSelect
                  value={fixtureId ?? ""}
                  onChange={(v) => setFixtureId(v || null)}
                  placeholder={fixturesLoading ? "Loading matches…" : "Not linked"}
                  options={fixtures.map(
                    (f) =>
                      [
                        f.id,
                        `${f.opponent}${f.score ? ` (${f.score.home}-${f.score.away})` : ""}${
                          f.status === "FT" ? "" : ` · ${f.status}`
                        }`,
                      ] as const
                  )}
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Article
                </Button>
              )}
              {isEditing && (
                <Button onClick={handleSuggestTags} disabled={isLoading}>
                  {isSuggestingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save and Suggest Tags
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {showStep3 && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold text-base mt-6 mb-2">{isCreatingNew ? 'Step 3' : 'Step 2'}: Add or Remove Tags</h3>
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
              </>
            )}
          </div>
        </>
      )}
      
      {showStep4 && (
        <>
            <Separator />
            <div>
                <h3 className="font-semibold text-base mt-6 mb-2">{isCreatingNew ? 'Step 4' : 'Step 3'}: Upload Header Image</h3>
                 <div className="aspect-video mt-1 rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                    {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" layout="fill" objectFit="cover" className="rounded-lg" />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <UploadCloud className="mx-auto h-12 w-12" />
                            <p className="mt-2 text-sm">Upload a landscape cover</p>
                        </div>
                    )}
                    <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleImageFileChange}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Used for listing thumbnails, social previews and the article hero.
                </p>
            </div>
            <div className="mt-6">
                <Label className="font-semibold">Portrait hero (optional)</Label>
                <div className="aspect-[4/5] max-w-[200px] mt-2 rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                    {heroPreview ? (
                        <Image src={heroPreview} alt="Portrait hero preview" layout="fill" objectFit="cover" className="rounded-lg" />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <UploadCloud className="mx-auto h-8 w-8" />
                            <p className="mt-1 text-xs">No portrait</p>
                        </div>
                    )}
                    <Input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleHeroFileChange}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Covers are cropped to fill the hero. A full-length photo uploaded here gets a
                    taller frame instead, so the whole picture shows. Leave empty to use the
                    landscape cover above.
                </p>
                {heroPreview && (
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRemoveHero} disabled={isLoading}>
                        <X className="mr-2 h-3 w-3" />
                        Remove portrait hero
                    </Button>
                )}
            </div>
            <div className="mt-6">
                <Label className="font-semibold">Mobile hero (optional)</Label>
                <div className="aspect-[4/5] max-w-[200px] mt-2 rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                    {mobileHeroPreview ? (
                        <Image src={mobileHeroPreview} alt="Mobile hero preview" layout="fill" objectFit="cover" className="rounded-lg" />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <UploadCloud className="mx-auto h-8 w-8" />
                            <p className="mt-1 text-xs">No mobile hero</p>
                        </div>
                    )}
                    <Input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleMobileHeroFileChange}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Shown to phones only, in a taller frame. Leave empty and phones use the
                    portrait hero, or the landscape cover if there is none.
                </p>
                {mobileHeroPreview && (
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRemoveMobileHero} disabled={isLoading}>
                        <X className="mr-2 h-3 w-3" />
                        Remove mobile hero
                    </Button>
                )}
            </div>
            <div className="mt-6">
                <Label className="font-semibold">More photos ({photos.length})</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                    Extra pictures for this article, shown as a gallery under the story. Pick as many
                    as you like at once — the cover above stays separate.
                </p>

                {photos.length > 0 && (
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                        {photos.map((photo, index) => (
                            <li key={photo.key} className="rounded-lg border border-dashed p-2">
                                <div className="relative aspect-video overflow-hidden rounded bg-muted">
                                    {photo.preview && (
                                        <Image src={photo.preview} alt="" fill sizes="(min-width: 640px) 18rem, 100vw" className="object-cover" unoptimized />
                                    )}
                                    <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[10px]">
                                        {index + 1}
                                    </span>
                                </div>
                                <Input
                                    className="mt-2"
                                    placeholder="Caption (optional)"
                                    value={photo.caption}
                                    onChange={(e) => handlePhotoCaption(photo.key, e.target.value)}
                                    disabled={isLoading}
                                />
                                <div className="mt-2 flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMovePhoto(index, -1)}
                                        disabled={index === 0 || isLoading}
                                        aria-label={`Move photo ${index + 1} earlier`}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMovePhoto(index, 1)}
                                        disabled={index === photos.length - 1 || isLoading}
                                        aria-label={`Move photo ${index + 1} later`}
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto text-destructive"
                                        onClick={() => handleRemovePhoto(photo.key)}
                                        disabled={isLoading}
                                    >
                                        <Trash2 className="mr-2 h-3 w-3" />
                                        Remove
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <label className="mt-3 flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 text-center text-muted-foreground hover:border-primary/50">
                    <span>
                        <UploadCloud className="mx-auto h-6 w-6" />
                        <span className="mt-1 block text-xs">Add photos</span>
                    </span>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={handlePhotoFilesChange}
                        disabled={isLoading}
                    />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                    Uploaded when you publish, so a photo you remove before then is never sent.
                </p>
            </div>
        </>
      )}

      {imagePreview && (
         <>
          <Separator />
           <div>
              <h3 className="font-semibold text-base mt-6 mb-2">{isCreatingNew ? 'Step 5' : 'Step 4'}: Review Social Posts</h3>
              <Button onClick={handleGenerateSocial} disabled={isLoading}>
                {isGeneratingSocial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Generate Social Posts
              </Button>
           </div>
         </>
      )}

      {showStep5 && (
        <>
           <div className="mt-4">
              {isGeneratingSocial ? (
                 <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    <span>Generating social posts...</span>
                </div>
              ) : (
                socialPosts && <div className="space-y-4">
                    {/* Twitter */}
                    <div>
                        <Label className="flex items-center gap-2 mb-2"><Twitter className="h-5 w-5 text-[#1DA1F2]" /> Twitter Post</Label>
                        <Card className="bg-muted">
                            <CardContent className="p-3 relative">
                                <p className="text-sm whitespace-pre-wrap">{socialPosts.twitterPost}</p>
                                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(socialPosts.twitterPost || '')}>
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
                                <p className="text-sm whitespace-pre-wrap">{socialPosts.instagramPost}</p>
                                 <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(socialPosts.instagramPost || '')}>
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

      {(socialPosts || articleToEdit) && !isLoading && (
        <>
          <Separator />
          <div className="flex justify-end pt-6 gap-2">
            <Button onClick={resetForm} variant="outline">Cancel</Button>
            <Button onClick={handlePublish} size="lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              {articleToEdit ? 'Update Article' : 'Publish Article'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
