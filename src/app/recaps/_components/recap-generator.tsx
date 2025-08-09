
"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { addRecap } from "@/lib/recaps"

import { generateMatchRecap } from "@/ai/flows/generate-match-recap"
import type { GenerateMatchRecapOutput } from "@/ai/flows/generate-match-recap"
import type { Fixture } from "@/lib/data"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, Save, Trophy, ListOrdered, CheckCircle, Pencil } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const recapSchema = z.object({
  fixtureId: z.string({ required_error: "Please select a fixture." }),
  matchNotes: z.string().min(10, "Please provide some notes about the match."),
})

type RecapFormData = z.infer<typeof recapSchema>

export function RecapGenerator() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<GenerateMatchRecapOutput | null>(null)
  
  const [editedHeadline, setEditedHeadline] = useState("")
  const [editedRecap, setEditedRecap] = useState("")


  const { toast } = useToast()
  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<RecapFormData>({
    resolver: zodResolver(recapSchema),
  })

  useEffect(() => {
    const q = query(collection(db, "fixtures"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fixture));
      setFixtures(data);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerateRecap = async (data: RecapFormData) => {
    setIsLoading(true)
    setGeneratedContent(null)
    try {
      const result = await generateMatchRecap({ matchNotes: data.matchNotes })
      setGeneratedContent(result)
      setEditedHeadline(result.headline)
      setEditedRecap(result.fullRecap)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Failed to generate recap."})
    } finally {
      setIsLoading(false)
    }
  }
  
  const handlePublish = async () => {
    const fixtureId = watch("fixtureId");
    const selectedFixture = fixtures.find(f => f.id === fixtureId);

    if (!generatedContent || !selectedFixture) {
        toast({ variant: "destructive", title: "Error", description: "Missing generated content or selected fixture."})
        return;
    }
    
    setIsSubmitting(true);
    try {
        await addRecap({
            fixtureId: selectedFixture.id,
            headline: editedHeadline,
            shortSummary: generatedContent.shortSummary,
            fullRecap: editedRecap,
            timeline: generatedContent.timeline,
            structuredData: generatedContent.structuredData,
        }, selectedFixture)
        toast({ title: "Success!", description: "Match recap has been published as a news article."});
        reset();
        setGeneratedContent(null);
        setEditedHeadline("");
        setEditedRecap("");
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to publish recap."})
    } finally {
        setIsSubmitting(false);
    }
  }

  const fixtureIdValue = watch('fixtureId')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">1. Provide Match Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleGenerateRecap)} className="space-y-6">
            <div>
              <Label htmlFor="fixtureId">Select Fixture</Label>
               <Controller
                    name="fixtureId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a match..." />
                            </SelectTrigger>
                            <SelectContent>
                            {fixtures.map(f => {
                                const fixtureDate = (f.date as any).toDate ? (f.date as any).toDate() : new Date(f.date);
                                return <SelectItem key={f.id} value={f.id}>{f.opponent} ({fixtureDate.toLocaleDateString()})</SelectItem>
                            })}
                            </SelectContent>
                        </Select>
                    )}
                />
              {errors.fixtureId && <p className="text-sm text-destructive mt-1">{errors.fixtureId.message}</p>}
            </div>
            <div>
              <Label htmlFor="matchNotes">Match Notes</Label>
              <Textarea
                id="matchNotes"
                {...register("matchNotes")}
                placeholder="e.g., Final score 3-0. Rivera scored twice in the first half. Smith added a third from a penalty..."
                rows={8}
                disabled={isLoading}
              />
              {errors.matchNotes && <p className="text-sm text-destructive mt-1">{errors.matchNotes.message}</p>}
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Recap
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Output / Review */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">2. Review & Publish</CardTitle>
          {!generatedContent && !isLoading && <CardDescription>Generated content will appear here for review.</CardDescription>}
          {isLoading && <CardDescription>Generating your recap now, please wait...</CardDescription>}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {generatedContent && (
            <div className="space-y-6">
                <div>
                    <Label htmlFor="headline" className="font-semibold flex items-center gap-2 mb-2"><Trophy className="h-4 w-4" /> Headline</Label>
                    <Input id="headline" value={editedHeadline} onChange={(e) => setEditedHeadline(e.target.value)} disabled={isSubmitting} />
                </div>
                <div>
                    <Label htmlFor="fullRecap" className="font-semibold flex items-center gap-2 mb-2"><Pencil className="h-4 w-4" /> Full Recap</Label>
                    <Textarea id="fullRecap" value={editedRecap} onChange={(e) => setEditedRecap(e.target.value)} rows={12} disabled={isSubmitting}/>
                </div>
              
              <Separator />

              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2"><ListOrdered className="h-4 w-4" /> Match Timeline</h3>
                <Card className="bg-muted">
                    <CardContent className="p-4 space-y-3 text-sm">
                        <p><strong>Final Score: {generatedContent.structuredData.finalScore}</strong></p>
                        <p><strong>Goal Scorers:</strong> {generatedContent.structuredData.goalScorers.join(', ')}</p>
                        <ul className="space-y-2 mt-4">
                            {generatedContent.timeline.map((event, index) => (
                                <li key={index} className="flex gap-2">
                                    <span className="font-bold w-12">{event.minute}'</span>
                                    <span>[{event.type}] {event.player !== "N/A" && <strong>{event.player}:</strong>} {event.description}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
              </div>
              <Button onClick={handlePublish} disabled={isSubmitting || !fixtureIdValue} className="w-full" size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Publish Recap as News
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
