
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { addNewsArticle, deleteNewsArticle, updateNewsArticle } from "@/lib/news"
import { useToast } from "@/hooks/use-toast"
import type { NewsArticle } from "@/lib/data"
import Image from "next/image"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/use-auth"

export default function NewsPage() {
  const [publishedArticles, setPublishedArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [articleToEdit, setArticleToEdit] = useState<NewsArticle | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, "news"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setPublishedArticles(articlesData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching articles:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch news articles."})
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handlePublish = async (
    article: { headline: string; content: string; tags: string[]; imageFile: File | null },
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
      handleFinishEditing();
    } catch (error) {
       console.error("Error publishing article:", error);
       toast({ variant: "destructive", title: "Error", description: `Failed to ${articleId ? 'update' : 'publish'} article.` })
    }
  };

  const handleDelete = async (article: NewsArticle) => {
    try {
      await deleteNewsArticle(article);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
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
      
      <Separator />
       <div>
        <h2 className="text-2xl font-headline font-bold mb-4">Published Articles</h2>
        <div className="space-y-6">
          {isLoading ? (
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
             </div>
          ) : publishedArticles.length > 0 ? (
            publishedArticles.map(article => (
              <Card key={article.id} className="relative group/article">
                 {article.imageUrl && (
                    <div className="aspect-video relative">
                        <Image src={article.imageUrl} alt={article.headline} fill className="object-cover rounded-t-lg" data-ai-hint="news header" />
                    </div>
                  )}
                <CardHeader>
                  <CardTitle className="font-headline">{article.headline}</CardTitle>
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
                 {user && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/article:opacity-100 transition-opacity">
                        <Button size="icon" variant="outline" className="h-8 w-8 bg-background/80" onClick={() => handleEdit(article)}>
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
                                    <AlertDialogAction onClick={() => handleDelete(article)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                 )}
              </Card>
            ))
          ) : (
            <div className="text-center py-16 rounded-lg bg-muted">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Articles Published</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                  Use the content workflow above to publish your first article.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
