
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
import { cn } from "@/lib/utils"


import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Radio, Mic, Send, Users, Shield, Goal, RectangleVertical, Repeat, Trophy, Info, PlayCircle, ArrowRight } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// --- LiveUpdateForm Component ---
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { postLiveUpdate } from "@/lib/fixtures"
import { generateEventText } from "@/ai/flows/generate-event-text"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const EventTypeSchema = z.enum(["Goal", "Substitution", "Red Card", "Info"]);
type EventType = z.infer<typeof EventTypeSchema>;

const updateSchema = z.object({
  homeScore: z.coerce.number().min(0),
  awayScore: z.coerce.number().min(0),
  scorerId: z.string().optional(),
  assistId: z.string().optional(),
  subOffId: z.string().optional(),
  subOnId: z.string().optional(),
  cardPlayerId: z.string().optional(),
  infoText: z.string().optional(),
  teamForGoal: z.string().optional(),
})
type UpdateFormData = z.infer<typeof updateSchema>

function LiveUpdateForm({ fixture, teamProfile }: { fixture: Fixture, teamProfile: TeamProfile }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isPosting, setIsPosting] = useState(false)
  const [eventType, setEventType] = useState<EventType | null>(null);

  const activePlayers = fixture.activePlayers || fixture.startingXI || [];
  const benchedPlayers = fixture.substitutes?.filter(sub => !activePlayers.some(ap => ap.id === sub.id)) || [];

  const { register, handleSubmit, control, watch, setValue, reset, getValues } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      homeScore: fixture.score?.home ?? 0,
      awayScore: fixture.score?.away ?? 0,
    }
  });

  useEffect(() => {
    reset({
      homeScore: fixture.score?.home ?? 0,
      awayScore: fixture.score?.away ?? 0,
    });
  }, [fixture, reset]);

  const handleKickoff = async () => {
      setIsPosting(true);
      try {
          await postLiveUpdate(fixture.id, {
              homeScore: fixture.score?.home ?? 0,
              awayScore: fixture.score?.away ?? 0,
              status: 'LIVE',
              eventType: 'Match Start',
              eventText: 'The match has kicked off!',
          });
          toast({ title: "KICKOFF!", description: "The match is now live." });
      } catch(error) {
          console.error("Error starting match:", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to start the match."});
      } finally {
          setIsPosting(false);
      }
  };

  const handlePostUpdate = async (data: UpdateFormData) => {
    if (!eventType) return;
    setIsPosting(true);

    let eventText = "";
    let submissionData: any = {};
    const { homeScore, awayScore } = data;
    
    try {
        let aiPayload: any = { eventType, homeScore, awayScore };
        
        switch (eventType) {
            case "Goal":
                const scorer = activePlayers.find(p => p.id === data.scorerId);
                const assister = activePlayers.find(p => p.id === data.assistId);
                if (!scorer || !data.teamForGoal) {
                    toast({ variant: "destructive", title: "Error", description: "A goal scorer and team must be selected." });
                    setIsPosting(false); return;
                }
                aiPayload.playerName = scorer.name;
                aiPayload.assistPlayerName = assister?.name;
                aiPayload.teamName = data.teamForGoal === 'home' ? teamProfile.name : fixture.opponent;
                submissionData.goal = { scorer, assist: assister };
                break;

            case "Substitution":
                const subOff = activePlayers.find(p => p.id === data.subOffId);
                const subOn = benchedPlayers.find(p => p.id === data.subOnId);
                if (!subOff || !subOn) {
                    toast({ variant: "destructive", title: "Error", description: "Both players for a substitution must be selected." });
                    setIsPosting(false); return;
                }
                aiPayload.subOffPlayerName = subOff.name;
                aiPayload.subOnPlayerName = subOn.name;
                aiPayload.teamName = teamProfile.name;
                submissionData.substitution = { subOffPlayer: subOff, subOnPlayer: subOn };
                break;

            case "Red Card":
                const cardedPlayer = activePlayers.find(p => p.id === data.cardPlayerId);
                if (!cardedPlayer) {
                    toast({ variant: "destructive", title: "Error", description: "A player must be selected for the red card." });
                    setIsPosting(false); return;
                }
                aiPayload.playerName = cardedPlayer.name;
                aiPayload.teamName = teamProfile.name;
                submissionData.playerName = cardedPlayer.name;
                break;
            
            case "Info":
                if (!data.infoText?.trim()) {
                    toast({ variant: "destructive", title: "Error", description: "Please enter some info text." });
                    setIsPosting(false); return;
                }
                eventText = data.infoText;
                break;
        }

        // Generate text via AI for structured events
        if (eventType !== 'Info') {
            const result = await generateEventText(aiPayload);
            eventText = result.eventText;
        }

        await postLiveUpdate(fixture.id, {
            homeScore,
            awayScore,
            status: fixture.status,
            eventType: eventType,
            eventText,
            ...submissionData,
        });

        toast({ title: "Success", description: "Live update posted!" });
        reset({ homeScore, awayScore, infoText: '', scorerId: '', assistId: '', subOffId: '', subOnId: '', cardPlayerId: '', teamForGoal: '' });
        setEventType(null);

    } catch(error) {
        console.error("Error posting update:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to post update."});
    } finally {
        setIsPosting(false);
    }
  }

  const renderEventForm = () => {
      switch (eventType) {
          case 'Goal':
              return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                           <Label>Team</Label>
                           <Controller name="teamForGoal" control={control} render={({ field }) => (
                               <Select onValueChange={field.onChange} value={field.value}>
                                   <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="home">{teamProfile.name}</SelectItem>
                                       <SelectItem value="away">{fixture.opponent}</SelectItem>
                                   </SelectContent>
                               </Select>
                           )} />
                      </div>
                      <div className="space-y-2">
                          <Label>Scorer</Label>
                          <Controller name="scorerId" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select goal scorer..." /></SelectTrigger><SelectContent>{activePlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                          )} />
                      </div>
                      <div className="space-y-2">
                          <Label>Assist (Optional)</Label>
                          <Controller name="assistId" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select assist provider..." /></SelectTrigger><SelectContent>{activePlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                          )} />
                      </div>
                  </div>
              );
          case 'Substitution':
              return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                       <div className="space-y-2">
                          <Label>Player Off</Label>
                          <Controller name="subOffId" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger><SelectContent>{activePlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                          )} />
                      </div>
                       <ArrowRight className="h-6 w-6 text-muted-foreground mx-auto hidden md:block" />
                       <div className="space-y-2">
                          <Label>Player On</Label>
                           <Controller name="subOnId" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger><SelectContent>{benchedPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                          )} />
                      </div>
                  </div>
              );
          case 'Red Card':
               return (
                   <div className="space-y-2">
                       <Label>Player</Label>
                       <Controller name="cardPlayerId" control={control} render={({ field }) => (
                           <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger><SelectContent>{activePlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                       )} />
                   </div>
               );
          case 'Info':
               return (
                  <div className="space-y-2">
                    <Label>Information Text</Label>
                    <Textarea {...register('infoText')} placeholder="e.g. Added time, injury update..." rows={3}/>
                  </div>
               );
          default:
              return null;
      }
  }
  
  if (!user) return null;

  if (fixture.status === 'UPCOMING') {
      return (
        <Card className="border-primary border-2">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2"><PlayCircle className="text-primary"/> Start Match</CardTitle>
                <CardDescription>Begin the match to enable live updates.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleKickoff} disabled={isPosting} className="w-full" size="lg">
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    KICKOFF
                </Button>
            </CardContent>
        </Card>
      );
  }

  return (
    <Card className="border-primary border-2">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Mic className="text-primary"/> Admin: Post Live Update</CardTitle>
        <CardDescription>Update score, status, and post an event to the live feed for this match.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handlePostUpdate)} className="space-y-6">
            
            <div className="space-y-2">
                <Label>Score</Label>
                <div className="flex items-center gap-4">
                    <Input type="number" placeholder="Home" {...register("homeScore")} />
                    <span className="font-bold">-</span>
                    <Input type="number" placeholder="Away" {...register("awayScore")} />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Event Type</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(Object.keys(EventTypeSchema.Values) as EventType[]).map(type => (
                        <Button key={type} type="button" variant={eventType === type ? 'default' : 'outline'} onClick={() => setEventType(type)}>
                            {type}
                        </Button>
                    ))}
                </div>
            </div>
            
            {eventType && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <h4 className="font-semibold text-lg">{eventType} Details</h4>
                    {renderEventForm()}
                </div>
            )}

            <Button type="submit" disabled={isPosting || !eventType} className="w-full">
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
    "Info": <Info className="h-4 w-4 text-white" />,
    "Match Start": <PlayCircle className="h-4 w-4 text-white" />,
    "Match End": <Trophy className="h-4 w-4 text-white" />,
}

const eventColors = {
    "Goal": "bg-yellow-500",
    "Red Card": "bg-red-600",
    "Substitution": "bg-blue-500",
    "Info": "bg-gray-500",
    "Match Start": "bg-green-500",
    "Match End": "bg-primary",
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
    
    const renderEventText = (update: LiveEvent) => {
        if (update.type === "Substitution" && update.subOffPlayer && update.subOnPlayer) {
            return (
                <span>
                    <span className="text-red-500 font-semibold">{update.subOffPlayer.name}</span>
                    <ArrowRight className="inline-block mx-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-green-500 font-semibold">{update.subOnPlayer.name}</span>
                </span>
            )
        }
        if (update.type === "Goal" && update.playerName) {
             return (
                <span>
                    <span className="font-bold">{update.playerName}</span> scores!
                    {update.assistPlayer && <span className="text-muted-foreground text-xs block">Assist by {update.assistPlayer.name}</span>}
                </span>
            )
        }
        return update.text;
    }

    return updates.length > 0 ? (
        <div className="space-y-6 border-l-2 border-primary/20 pl-8 relative">
             {updates.map((update) => (
                 <div key={update.id} className="relative">
                    <div className={cn("absolute -left-[45px] top-1 h-8 w-8 rounded-full flex items-center justify-center", eventColors[update.type as keyof typeof eventColors] || "bg-primary")}>
                       {eventIcons[update.type as keyof typeof eventIcons]}
                    </div>
                    <p className="text-sm font-semibold">{renderEventText(update)}</p>
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
                        <h2 className="font-headline text-3xl">{teamProfile.name}</h2>
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={teamProfile.logoUrl} alt={teamProfile.name} data-ai-hint="team logo" />
                            <AvatarFallback>{teamProfile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="px-8">
                        <span className="text-4xl font-bold">{fixture.status === 'UPCOMING' ? "vs" : `${fixture.score?.home ?? 0} - ${fixture.score?.away ?? 0}`}</span>
                         <Badge variant={fixture.status === 'LIVE' ? 'destructive' : 'secondary'} className="block mt-2 mx-auto">{fixture.status}</Badge>
                    </div>
                    <div className="flex-1 flex items-center justify-start gap-4">
                         <Avatar className="h-16 w-16">
                            <AvatarImage src={fixture.opponentLogoUrl} alt={fixture.opponent} data-ai-hint="team logo" />
                            <AvatarFallback>{fixture.opponent.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <h2 className="font-headline text-3xl">{fixture.opponent}</h2>
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
                                {teamProfile && fixture.startingXI && (
                                    <FormationDisplay
                                        teamName={teamProfile.name}
                                        startingXI={fixture.startingXI}
                                    />
                                )}
                                {fixture.substitutes && (
                                    <SubstitutesDisplay
                                        players={fixture.substitutes}
                                        title="Substitutes"
                                    />
                                )}
                            </div>
                         </TabsContent>
                    </Tabs>
                </CardHeader>
            </Card>
        </div>
    )
}
