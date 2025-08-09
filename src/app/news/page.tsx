"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { TagSuggester } from "./_components/tag-suggester"
import { Separator } from "@/components/ui/separator"
import { newsArticles } from "@/lib/data"
import type { NewsArticle } from "@/lib/data"

type PublishedArticle = {
  headline: string;
  content: string;
  date: string;
  id: string;
}

export default function NewsPage() {
  const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>([]);

  const handlePublishArticle = (article: { headline: string; content: string }) => {
    const newArticle: PublishedArticle = {
      ...article,
      id: `new-${publishedArticles.length + 1}`,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
    setPublishedArticles([newArticle, ...publishedArticles]);
  };

  const initialArticles = newsArticles.map(a => ({...a, id: `initial-${a.id}`}))

  const allArticles = [...publishedArticles, ...initialArticles];


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">News & Content Creation</h1>
        <p className="text-muted-foreground mt-2">Use AI-powered tools to generate articles, suggest tags, and publish content.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Article Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <NewsEditor onPublish={handlePublishArticle} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Content Tagging</CardTitle>
          </CardHeader>
          <CardContent>
            <TagSuggester />
          </CardContent>
        </Card>
      </div>
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
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{article.content}</p>
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
