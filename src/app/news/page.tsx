import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NewsEditor } from "./_components/news-editor"
import { TagSuggester } from "./_components/tag-suggester"

export default function NewsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">News & Content Creation</h1>
        <p className="text-muted-foreground mt-2">Use AI-powered tools to generate articles and suggest content tags.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Article Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <NewsEditor />
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
    </div>
  )
}
