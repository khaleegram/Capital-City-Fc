
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { addNewsArticle } from "@/lib/news"
import { useToast } from "@/hooks/use-toast"
import type { NewsArticle } from "@/lib/data"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText } from "lucide-react"

export default function NewsPage() {
  const [publishedArticles, setPublishedArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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


  const handlePublishArticle = async (article: { headline: string; content: string; tags: string[] }) => {
    try {
      await addNewsArticle(article);
      toast({
        title: "Success!",
        description: "Your article has been published.",
        className: "bg-green-500 text-white",
      });
    } catch (error) {
       console.error("Error publishing article:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to publish article."})
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">News & Content Creation</h1>
        <p className="text-muted-foreground mt-2">Use AI-powered tools to generate articles, suggest tags, and publish content.</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Content Workflow</CardTitle>
          <CardDescription>Follow the steps to generate, edit, and publish your news article.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewsEditor onPublish={handlePublishArticle} />
        </CardContent>
      </Card>
      
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
              <Card key={article.id}>
                <CardHeader>
                  <CardTitle className="font-headline">{article.headline}</CardTitle>
                   <CardDescription>{new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground whitespace-pre-line">{article.content}</p>
                   {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      {article.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16">
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
