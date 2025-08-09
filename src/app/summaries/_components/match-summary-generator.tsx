"use client"

import { useState } from "react"
import { generateMatchRecap } from "@/ai/flows/generate-match-recap"
import type { GenerateMatchRecapOutput } from "@/ai/flows/generate-match-recap"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, Sparkles, FileText, Calendar, Users, Edit, Save } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"


export function MatchSummaryGenerator() {
  const [matchNotes, setMatchNotes] = useState("")
  const [generatedContent, setGeneratedContent] = useState<GenerateMatchRecapOutput | null>(null)
  const [editedContent, setEditedContent] = useState<Partial<GenerateMatchRecapOutput>>({})

  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!matchNotes.trim()) return
    setIsLoading(true)
    setGeneratedContent(null)
    setEditedContent({})
    setIsEditing(false)

    try {
      const result = await generateMatchRecap({ matchNotes })
      setGeneratedContent(result)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate match recap. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditChange = (field: keyof GenerateMatchRecapOutput, value: string) => {
    setEditedContent(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    // In a real app, this would save the final content to your CMS/database.
    // The final content is a merge of the original generated content and the edits.
    const finalContent = { ...generatedContent, ...editedContent };

    console.log("Saving content:", finalContent);
    toast({
        title: "Content Saved!",
        description: "The match recap has been saved successfully.",
        className: "bg-green-500 text-white"
    });

    // Reset state after saving
    setMatchNotes("");
    setGeneratedContent(null);
    setEditedContent({});
    setIsEditing(false);
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "Goal":
        return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M8 10l8 4-8 4V10z"></path></svg>; // A simple soccer ball icon
      case "Yellow Card":
        return <div className="h-4 w-3 bg-yellow-400 border border-black" />;
      case "Red Card":
        return <div className="h-4 w-3 bg-red-600 border border-black" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  const finalHeadline = editedContent.headline ?? generatedContent?.headline;
  const finalShortSummary = editedContent.shortSummary ?? generatedContent?.shortSummary;
  const finalFullRecap = editedContent.fullRecap ?? generatedContent?.fullRecap;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">AI-Powered Match Recap Generator</CardTitle>
        <CardDescription>Enter match notes or bullet points to generate a full suite of content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Input */}
        <div>
            <Label htmlFor="match-notes" className="font-semibold text-base">Step 1: Provide Match Notes</Label>
            <Textarea
              id="match-notes"
              value={matchNotes}
              onChange={(e) => setMatchNotes(e.target.value)}
              placeholder="e.g.&#10;- We won 3-0 against Lions FC.&#10;- John scored twice (15', 78'), and Mark scored one (55').&#10;- Alex got a yellow card in the 30th minute."
              className="mt-2 min-h-[150px]"
              disabled={isLoading || !!generatedContent}
            />
            <Button onClick={handleGenerate} disabled={isLoading || !matchNotes.trim() || !!generatedContent} className="mt-4">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Generate Recap
            </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
            <div className="flex flex-col items-center justify-center text-center p-8 border-t">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <h3 className="text-lg font-semibold">Generating Content...</h3>
                <p className="text-muted-foreground">The AI is analyzing the match notes. This may take a moment.</p>
            </div>
        )}

        {/* Step 2: Review & Edit */}
        {generatedContent && !isLoading && (
            <>
                <Separator />
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-base">Step 2: Review and Edit Generated Content</h2>
                        {!isEditing && (
                             <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        {/* Headline */}
                        <div>
                            <Label htmlFor="headline" className="font-medium text-primary">Headline</Label>
                            {isEditing ? (
                                <Input id="headline" value={finalHeadline} onChange={(e) => handleEditChange('headline', e.target.value)} className="text-lg font-bold" />
                            ) : (
                                <p className="text-lg font-bold font-headline mt-1">{finalHeadline}</p>
                            )}
                        </div>

                        {/* Short Summary */}
                        <div>
                            <Label htmlFor="shortSummary" className="font-medium text-primary">Short Summary</Label>
                             {isEditing ? (
                                <Textarea id="shortSummary" value={finalShortSummary} onChange={(e) => handleEditChange('shortSummary', e.target.value)} rows={2} />
                            ) : (
                                <p className="text-muted-foreground mt-1">{finalShortSummary}</p>
                            )}
                        </div>

                        {/* Full Recap */}
                        <div>
                            <Label htmlFor="fullRecap" className="font-medium text-primary">Full Recap Article</Label>
                             {isEditing ? (
                                <Textarea id="fullRecap" value={finalFullRecap} onChange={(e) => handleEditChange('fullRecap', e.target.value)} rows={10} />
                            ) : (
                                <Card className="mt-2 bg-muted/50">
                                    <CardContent className="p-4 prose prose-sm max-w-none whitespace-pre-wrap">
                                        <p>{finalFullRecap}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Event Timeline */}
                        <div>
                            <h3 className="font-medium text-primary mb-2">Event Timeline</h3>
                            <div className="space-y-2 rounded-md border p-4">
                               {generatedContent.timeline.length > 0 ? generatedContent.timeline.map((event, index) => (
                                   <div key={index} className="flex items-center gap-4">
                                       <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                                            {getEventIcon(event.type)}
                                       </div>
                                       <div className="flex-1">
                                           <p className="font-semibold text-sm">{event.description}</p>
                                           <p className="text-xs text-muted-foreground">{event.player} - {event.minute}'</p>
                                       </div>
                                   </div>
                               )) : <p className="text-sm text-muted-foreground">No specific events were found in the notes.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 3: Save */}
                <Separator />
                 <div className="flex justify-between items-center">
                    <Button variant="ghost" onClick={() => { setGeneratedContent(null); setMatchNotes('')}}>Start Over</Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleGenerate}>
                            <Sparkles className="mr-2 h-4 w-4" /> Regenerate
                        </Button>
                        <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" /> Save to CMS
                        </Button>
                    </div>
                </div>
            </>
        )}
      </CardContent>
    </Card>
  )
}
