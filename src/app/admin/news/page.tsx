
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { addNewsArticle, deleteNewsArticle, setArticlePublished, updateNewsArticle, type ArticlePhotoInput } from "@/lib/news"
import { refreshPublic } from "@/lib/admin-client"
import { focusStyle } from "@/lib/image-position"
import { useToast } from "@/hooks/use-toast"
import type { NewsArticle } from "@/lib/data"
import Image from "next/image"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Edit, Trash2, Eye, EyeOff, Images } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/use-auth"
import { DraftTabs, useDraftView, type DraftView } from "@/components/admin/draft-tabs"

/**
 * One article in the admin.
 *
 * A draft is anything the match hub wrote that nobody has read yet, so the two states are shown
 * differently: a draft is badged, and getting it onto the site is one button. An article a person
 * wrote is live already, and unpublishing it is the deliberate act.
 */
function ArticleCard({
  article,
  onEdit,
  onDelete,
  onTogglePublished,
  busy,
}: {
  article: NewsArticle
  onEdit: (a: NewsArticle) => void
  onDelete: (a: NewsArticle) => void
  onTogglePublished: (a: NewsArticle) => void
  busy: boolean
}) {
  const isDraft = article.published === false

  return (
    <Card className="relative group/article">
      {article.imageUrl && (
        <div className="aspect-video relative">
          <Image src={article.imageUrl} alt={article.headline} fill className="object-cover rounded-t-lg" style={focusStyle(article.imagePosition)} data-ai-hint="news header" />
        </div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-headline">{article.headline}</CardTitle>
          {isDraft ? (
            <Badge variant="outline" className="border-gold/50 text-gold">Draft</Badge>
          ) : (
            <Badge variant="outline">Live</Badge>
          )}
          {/* Provenance, so it's clear which articles were machine-written and can be rewritten. */}
          {article.generatedFrom && (
            <Badge variant="secondary" className="text-[10px]">
              {article.generatedFrom === "match" ? "Match report" : article.generatedFrom === "preview" ? "Preview" : "Recap"}
            </Badge>
          )}
          {article.fixtureId && (
            <Badge variant="outline" className="border-info/50 text-info text-[10px]">Linked to a match</Badge>
          )}
          {/* So a gallery is visible from the list without opening the article. */}
          {!!article.photos?.length && (
            <Badge variant="outline" className="text-[10px]">
              <Images className="mr-1 h-3 w-3" />
              {article.photos.length} {article.photos.length === 1 ? "photo" : "photos"}
            </Badge>
          )}
        </div>
        <CardDescription>{new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
      </CardHeader>
      <CardContent>
        {article.audioUrl && (
          <div className="mb-4">
            <audio controls className="w-full">
              <source src={article.audioUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        <p className="text-sm text-foreground whitespace-pre-line line-clamp-4">{article.content}</p>
      </CardContent>
      <CardFooter className="flex-wrap">
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t w-full">
            {article.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}
      </CardFooter>
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/article:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant={isDraft ? "default" : "outline"}
          className="h-8 w-8"
          disabled={busy}
          onClick={() => onTogglePublished(article)}
          title={isDraft ? "Publish — makes it visible on the site" : "Unpublish — pulls it off the site"}
        >
          {isDraft ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="sr-only">{isDraft ? "Publish" : "Unpublish"}</span>
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onEdit(article)}>
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="destructive" className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this news article.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(article)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [articleToEdit, setArticleToEdit] = useState<NewsArticle | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Published or Drafts. Published by default, so drafts only appear when asked for. */
  const [view, setView] = useState<DraftView>("published");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, "news"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setArticles(articlesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching articles:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch news articles."})
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handlePublish = async (
    article: { headline: string; content: string; tags: string[]; imageFile: File | null; heroImageFile: File | null; heroImageMobileFile: File | null; clearHeroImage: boolean; clearHeroImageMobile: boolean; photos: ArticlePhotoInput[]; fixtureId?: string | null },
    articleId?: string
  ) => {
    try {
      if (articleId) {
        await updateNewsArticle(articleId, article);
        toast({ title: "Success!", description: "Your article has been updated." });
      } else {
        await addNewsArticle(article);
        toast({ title: "Success!", description: "Your article has been published." });
      }
      await refreshPublic("news", "fixtures");
      handleFinishEditing();
    } catch (error) {
       console.error("Error publishing article:", error);
       toast({ variant: "destructive", title: "Error", description: `Failed to ${articleId ? 'update' : 'publish'} article.` })
    }
  };

  const handleTogglePublished = async (article: NewsArticle) => {
    const next = article.published === false;
    setBusyId(article.id);
    try {
      await setArticlePublished(article.id, next);
      await refreshPublic("news");
      toast({
        title: next ? "Published" : "Unpublished",
        description: next ? "It's live on the site now." : "Pulled off the site. It's still here as a draft.",
      })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message })
    } finally {
      setBusyId(null)
    }
  };

  const handleDelete = async (article: NewsArticle) => {
    try {
      await deleteNewsArticle(article);
      await refreshPublic("news");
      toast({ title: "Success", description: "Article deleted." });
    } catch (error) {
      console.error("Error deleting article:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete article." });
    }
  };

  const handleEdit = (article: NewsArticle) => {
    setArticleToEdit(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinishEditing = () => {
    setArticleToEdit(null);
  };

  // `rows` is whichever tab is showing; the other two are the counts the tabs need.
  const { rows, published: liveCount, drafts: draftCount } = useDraftView(articles, view)

  const renderList = (rows: NewsArticle[], empty: { title: string; body: string }) => (
    <div className="space-y-6">
      {rows.length > 0 ? (
        rows.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTogglePublished={handleTogglePublished}
            busy={busyId === article.id}
          />
        ))
      ) : (
        <div className="text-center py-16 rounded-lg bg-muted">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">{empty.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{empty.body}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">News & Content Creation</h1>
        <p className="text-muted-foreground mt-2">Browse the latest club news or use AI-powered tools to publish new articles.</p>
      </div>

      {user && (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">{articleToEdit ? 'Edit Article' : 'Content Workflow'}</CardTitle>
              <CardDescription>
                {articleToEdit ? `You are now editing: "${articleToEdit.headline}"` : 'Follow the steps to generate, edit, and publish your news article.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewsEditor
                onPublish={handlePublish}
                articleToEdit={articleToEdit}
                onFinishEditing={handleFinishEditing}
              />
            </CardContent>
          </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/*
            * Drafts have their own tab rather than a section pinned above the published list.
            * They still need to be findable — a finished match's report lands here and nothing
            * else announces it — which is what the gold count on the tab is for.
            */}
          <DraftTabs value={view} onChange={setView} published={liveCount} drafts={draftCount} />
          {view === "drafts" ? (
            renderList(rows, { title: "No drafts", body: "Match reports land here when a match gets a result." })
          ) : (
            renderList(rows, { title: "No Articles Published", body: "Use the content workflow above to publish your first article." })
          )}
        </div>
      )}
    </div>
  )
}
