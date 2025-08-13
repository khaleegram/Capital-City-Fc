
"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Fixture, TeamProfile, LiveEvent } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { getTeamProfile } from "@/lib/team"
import { useAuth } from "@/hooks/use-auth"


import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Radio, Mic, Send } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// --- LiveUpdateForm Component ---
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { postLiveUpdate } from "@/lib/fixtures"
import { generateMatchSummary } from "@/ai/flows/generate-match-summary"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Wand2 } from "lucide-react"

const updateSchema = z.object({
  homeScore: z.coerce.number().min(0),
  awayScore: z.coerce.number().min(0),
  status: z.enum(["UPCOMING", "LIVE", "FT"]),
  eventText: z.string().min(5, "Event description is required."),
  eventType: z.enum(["Goal", "Red Card", "Match End", "Info"]),
  noteForAI: z.string().optional(),
})
type UpdateFormData = z.infer<typeof updateSchema>

function LiveUpdateForm({ fixture }: { fixture: Fixture }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
        homeScore: fixture.score.home,
        awayScore: fixture.score.away,
        status: fixture.status,
        eventType: "Info",
    }
  })

  useEffect(() => {
    reset({
        homeScore: fixture.score.home,
        awayScore: fixture.score.away,
        status: fixture.status,
        eventType: "Info",
        eventText: "",
        noteForAI: "",
    })
  }, [fixture, reset])

  const noteForAI = watch("noteForAI")

  const handleGenerate = async () => {
    if (!noteForAI?.trim()) return
    setIsGenerating(true)
    try {
      const result = await generateMatchSummary({ note: noteForAI })
      setValue("eventText", result.update)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Failed to generate update." })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePostUpdate = async (data: UpdateFormData) => {
    setIsPosting(true);
    try {
        await postLiveUpdate(fixture.id, data);
        toast({ title: "Success", description: "Live update posted!" });
        setValue("noteForAI", "");
        setValue("eventText", "");
    } catch(error) {
        console.error("Error posting update:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to post update."});
    } finally {
        setIsPosting(false);
    }
  }
  
  if (!user) return null;

  return (
    <Card className="border-primary border-2">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Mic className="text-primary"/> Admin: Post Live Update</CardTitle>
        <CardDescription>Update score, status, and post an event to the live feed for this match.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handlePostUpdate)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <Label>Score</Label>
                        <div className="flex items-center gap-4">
                            <Input type="number" placeholder="Home" {...register("homeScore")} />
                            <span className="font-bold">-</span>
                            <Input type="number" placeholder="Away" {...register("awayScore")} />
                        </div>
                    </div>
                    <div>
                       <Label>Match Status</Label>
                        <Controller name="status" control={control} render={({ field }) => (
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="UPCOMING" id="upcoming" /><Label htmlFor="upcoming">Upcoming</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="LIVE" id="live" /><Label htmlFor="live">Live</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="FT" id="ft" /><Label htmlFor="ft">Full Time</Label></div>
                            </RadioGroup>
                        )} />
                    </div>
                </div>
                <div className="space-y-4">
                     <div>
                       <Label>Event Type</Label>
                        <Controller name="eventType" control={control} render={({ field }) => (
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Info" id="info" /><Label htmlFor="info">Info</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Goal" id="goal" /><Label htmlFor="goal">Goal</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Red Card" id="redcard" /><Label htmlFor="redcard">Red Card</Label></div>
                            </RadioGroup>
                        )} />
                    </div>
                     <div>
                        <Label htmlFor="noteForAI">Quick Note for AI</Label>
                        <div className="flex items-center gap-2">
                            <Input id="noteForAI" {...register("noteForAI")} placeholder="e.g., Rivera scores a header" />
                            <Button type="button" onClick={handleGenerate} disabled={isGenerating || !noteForAI?.trim()} variant="outline" size="icon">
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div>
              <Label htmlFor="eventText">Event Text for Feed</Label>
              <Textarea id="eventText" {...register("eventText")} placeholder="The text that will appear in the live feed. You can use the AI to generate it." rows={3} />
              {errors.eventText && <p className="text-sm text-destructive mt-1">{errors.eventText.message}</p>}
            </div>

            <Button type="submit" disabled={isPosting}>
                {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Post Update
            </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// --- LiveMatchFeed Component ---

function LiveMatchFeed({ fixtureId }: { fixtureId: string }) {
    const { toast } = useToast()
    const [updates, setUpdates] = useState<LiveEvent[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!fixtureId) return;

        const q = query(collection(db, "fixtures", fixtureId, "liveEvents"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveEvent));
            setUpdates(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching live updates:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch live updates." })
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [fixtureId, toast]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2"><Radio className="text-primary animate-pulse" /> Live Feed</CardTitle>
                <CardDescription>Updates from the match will appear here automatically.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : updates.length > 0 ? (
                    <div className="space-y-6 border-l-2 border-primary/20 pl-6 relative">
                         {updates.map((update) => (
                             <div key={update.id} className="relative">
                                <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-primary" />
                                <p className="text-sm font-semibold">{update.text}</p>
                                <p className="text-xs text-muted-foreground mt-1">{update.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                         ))}
                    </div>
                ) : (
                    <div className="text-center py-10"><p className="text-muted-foreground">Waiting for the match to begin...</p></div>
                )}
            </CardContent>
        </Card>
    )
}

// --- FixtureDetailsPage Component ---

export default function FixtureDetailsPage({ params }: { params: { id: string }}) {
    const { toast } = useToast()
    const [fixture, setFixture] = useState<Fixture | null>(null)
    const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true)
    const fixtureId = params.id;

    useEffect(() => {
        if (!fixtureId) return;
        
        const fetchProfile = async () => {
            try {
                const profile = await getTeamProfile();
                setTeamProfile(profile);
            } catch (error) {
                console.error("Failed to fetch team profile", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load team profile." });
            }
        }
        fetchProfile();

        const docRef = doc(db, "fixtures", fixtureId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                setFixture({ id: doc.id, ...doc.data() } as Fixture);
            } else {
                setFixture(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching fixture:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch fixture." });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [fixtureId, toast]);

    if (isLoading || !teamProfile) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!fixture) {
        notFound();
    }

    const fixtureDate = (fixture.date as any).toDate ? (fixture.date as any).toDate() : new Date(fixture.date);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
             <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-base">{fixture.competition}</Badge>
                         <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4"/>
                            {new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(fixtureDate)}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex items-center justify-center text-center">
                    <div className="flex-1 flex items-center justify-end gap-4">
                        <CardTitle className="font-headline text-3xl">{teamProfile.name}</CardTitle>
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={teamProfile.logoUrl} alt={teamProfile.name} data-ai-hint="team logo" />
                            <AvatarFallback>{teamProfile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="px-8">
                        <span className="text-4xl font-bold">{fixture.score.home} - {fixture.score.away}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-start gap-4">
                         <Avatar className="h-16 w-16">
                            <AvatarImage src={fixture.opponentLogoUrl} alt={fixture.opponent} data-ai-hint="team logo" />
                            <AvatarFallback>{fixture.opponent.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="font-headline text-3xl">{fixture.opponent}</CardTitle>
                    </div>
                </CardContent>
            </Card>

            {fixture.status === 'LIVE' && <LiveUpdateForm fixture={fixture} />}

            <Separator />
            
            <LiveMatchFeed fixtureId={fixture.id} />
        </div>
    )
}
