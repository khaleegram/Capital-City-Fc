
"use client"

import { useState, useEffect, use } from "react"
import { notFound } from "next/navigation"
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Fixture, TeamProfile, LiveEvent, Player } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { getTeamProfile } from "@/lib/team"
import { useAuth } from "@/hooks/use-auth"
import { FormationDisplay } from "@/app/formations/_components/formation-display"


import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Radio, Mic, Send, Users, Shield, Goal, RectangleVertical, Repeat } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Wand2 } from "lucide-react"

const updateSchema = z.object({
  homeScore: z.coerce.number().min(0),
  awayScore: z.coerce.number().min(0),
  status: z.enum(["UPCOMING", "LIVE", "FT"]),
  eventText: z.string().min(5, "Event description is required."),
  eventType: z.enum(["Goal", "Red Card", "Substitution", "Info"]),
  playerId: z.string().optional(),
  teamName: z.string().optional(),
  noteForAI: z.string().optional(),
})
type UpdateFormData = z.infer<typeof updateSchema>

function LiveUpdateForm({ fixture, teamProfile }: { fixture: Fixture, teamProfile: TeamProfile }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  
  const allInvolvedPlayers = [...(fixture.startingXI || []), ...(fixture.substitutes || [])];

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
        homeScore: fixture.score?.home ?? 0,
        awayScore: fixture.score?.away ?? 0,
        status: fixture.status,
        eventType: "Info",
    }
  })

  useEffect(() => {
    reset({
        homeScore: fixture.score?.home ?? 0,
        awayScore: fixture.score?.away ?? 0,
        status: fixture.status,
        eventType: "Info",
        eventText: "",
        noteForAI: "",
        playerId: "",
        teamName: "",
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
        setValue("playerId", "");
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
                        <Label>Quick Note for AI</Label>
                        <div className="flex items-center gap-2">
                            <Input {...register("noteForAI")} placeholder="e.g., Rivera scores a header" />
                            <Button type="button" onClick={handleGenerate} disabled={isGenerating || !noteForAI?.trim()} variant="outline" size="icon">
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div>
                        <Label>Event Type</Label>
                        <Controller name="eventType" control={control} render={({ field }) => (
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex items-center space-x-4 mt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Info" id="info" /><Label htmlFor="info">Info</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Goal" id="goal" /><Label htmlFor="goal">Goal</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Red Card" id="redcard" /><Label htmlFor="redcard">Red Card</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Substitution" id="sub" /><Label htmlFor="sub">Sub</Label></div>
                            </RadioGroup>
                        )} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Player Involved</Label>
                    <Controller name="playerId" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select a player..." /></SelectTrigger>
                            <SelectContent>
                                {allInvolvedPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
                <div>
                     <Label>Team Involved</Label>
                      <Controller name="teamName" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select a team..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={teamProfile.name}>{teamProfile.name}</SelectItem>
                                <SelectItem value={fixture.opponent}>{fixture.opponent}</SelectItem>
                            </SelectContent>
                        </Select>
                    )} />
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

function SubstitutesDisplay({ players, title }: { players: Player[], title: string }) {
    if (!players || players.length === 0) return null;

    return (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {players.map(player => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={player.imageUrl} alt={player.name} />
                            <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm">{player.name}</p>
                            <p className="text-xs text-muted-foreground">{player.position}</p>
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
    )
}

const eventIcons = {
    "Goal": <Goal className="h-4 w-4 text-white" />,
    "Red Card": <RectangleVertical className="h-4 w-4 text-white" />,
    "Substitution": <Repeat className="h-4 w-4 text-white" />,
    "Info": <Radio className="h-4 w-4 text-white" />,
    "Match End": <Trophy className="h-4 w-4 text-white" />,
}

const eventColors = {
    "Goal": "bg-green-500",
    "Red Card": "bg-red-600",
    "Substitution": "bg-blue-500",
    "Info": "bg-gray-500",
    "Match End": "bg-yellow-500",
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

    if (isLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return updates.length > 0 ? (
        <div className="space-y-6 border-l-2 border-primary/20 pl-8 relative">
             {updates.map((update) => (
                 <div key={update.id} className="relative">
                    <div className={cn("absolute -left-[45px] top-1 h-8 w-8 rounded-full flex items-center justify-center", eventColors[update.type as keyof typeof eventColors] || "bg-primary")}>
                       {eventIcons[update.type as keyof typeof eventIcons]}
                    </div>
                    <p className="text-sm font-semibold">{update.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{update.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             ))}
        </div>
    ) : (
        <div className="text-center py-10"><p className="text-muted-foreground">Waiting for the match to begin...</p></div>
    );
}

// --- FixtureDetailsPage Component ---
export default function FixtureDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: fixtureId } = use(params);
    const { toast } = useToast()
    const [fixture, setFixture] = useState<Fixture | null>(null)
    const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true)

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

    const hasLineup = fixture.startingXI && fixture.startingXI.length > 0;

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
                        <span className="text-4xl font-bold">{fixture.status === 'UPCOMING' ? "vs" : `${fixture.score?.home ?? 0} - ${fixture.score?.away ?? 0}`}</span>
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

            <LiveUpdateForm fixture={fixture} teamProfile={teamProfile} />
            
            <Separator />
            
            <Card>
                <CardHeader>
                    <Tabs defaultValue="feed" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="feed"><Radio className="mr-2 h-4 w-4"/>Live Feed</TabsTrigger>
                            <TabsTrigger value="lineups" disabled={!hasLineup}><Users className="mr-2 h-4 w-4" />Lineups</TabsTrigger>
                        </TabsList>
                        <CardDescription className="mt-4">
                            {hasLineup ? 'View live match updates or team lineups.' : 'View live match updates. Lineups will be available closer to kick-off.'}
                        </CardDescription>
                         <TabsContent value="feed" className="mt-6">
                            <LiveMatchFeed fixtureId={fixture.id} />
                         </TabsContent>
                         <TabsContent value="lineups" className="mt-6">
                            <div className="space-y-6">
                                <FormationDisplay
                                    teamName={teamProfile.name}
                                    startingXI={fixture.startingXI || []}
                                />
                                <SubstitutesDisplay
                                    players={fixture.substitutes || []}
                                    title="Substitutes"
                                />
                            </div>
                         </TabsContent>
                    </Tabs>
                </CardHeader>
            </Card>
        </div>
    )
}
