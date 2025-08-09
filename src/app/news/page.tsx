
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { Separator } from "@/components/ui/separator"
import { newsArticles as initialArticlesData } from "@/lib/data"
import { Badge } from "@/components/ui/badge"

type PublishedArticle = {
  headline: string;
  content: string;
  date: string;
  id: string;
  tags: string[];
}

export default function NewsPage() {
  const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>([]);

  const handlePublishArticle = (article: { headline: string; content: string; tags: string[] }) => {
    const newArticle: PublishedArticle = {
      ...article,
      id: `new-${publishedArticles.length + 1}`,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
    setPublishedArticles([newArticle, ...publishedArticles]);
  };

  const initialArticles = initialArticlesData.map(a => ({...a, id: `initial-${a.id}`}))

  const allArticles = [...publishedArticles, ...initialArticles];


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
          {allArticles.length > 0 ? (
            allArticles.map(article => (
              <Card key={article.id}>
                <CardHeader>
                  <CardTitle className="font-headline">{article.headline}</CardTitle>
                   <CardDescription>{article.date}</CardDescription>
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
            <p className="text-muted-foreground text-center py-8">No articles have been published yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
