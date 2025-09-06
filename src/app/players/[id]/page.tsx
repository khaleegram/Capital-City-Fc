
"use client"

import { useState, useEffect, use } from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { doc, onSnapshot, collection, query, where, getDocs, documentId, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Player, Video, NewsArticle } from "@/lib/data"
import { generatePlayerHighlightsVideo } from "@/ai/flows/generate-player-highlights-video"
import { addVideoWithTags, dataUriToBlob } from "@/lib/videos"


import { BarChart2, Clapperboard, Medal, User, Loader2, Newspaper, Footprints, Wand2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

function PlayerHighlightsTab({ player, videos, isLoading }: { player: Player, videos: Video[], isLoading: boolean }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateHighlightVideo = async () => {
        setIsGenerating(true);
        try {
            const result = await generatePlayerHighlightsVideo({
                playerImageUri: player.imageUrl, // Pass the URL directly
                playerName: player.name,
            });
            
            const videoBlob = dataUriToBlob(result.videoUrl);
            const videoFile = new File([videoBlob], `${player.name.replace(/\s/g, '_')}_highlight.mp4`, { type: 'video/mp4' });

            await addVideoWithTags({
                title: `${player.name} - AI Highlight Reel`,
                description: `An AI-generated highlight video for ${player.name}.`,
                video: videoFile
            }, [player]);

            toast({ title: "Success!", description: "AI highlight reel generated and added to videos." });

        } catch (error) {
            console.error("Error generating highlight video:", error);
            toast({ variant: "destructive", title: "Generation Failed", description: "Could not create the highlight video." });
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <div>
            {user && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl">AI Video Generation</CardTitle>
                        <CardDescription>Create a short, dynamic highlight reel for this player using their profile picture.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleGenerateHighlightVideo} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            {isGenerating ? 'Generating Video...' : 'Generate AI Highlight Reel'}
                        </Button>
                        {isGenerating && <p className="text-sm text-muted-foreground mt-2">This may take a minute or two. The page will update when complete.</p>}
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map((video) => (
                        <Link href={`/videos/${video.id}`} key={video.id}>
                            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="relative aspect-video">
                                    <Image src={video.thumbnailUrl || 'https://placehold.co/400x225.png'} alt={video.title} fill className="object-cover" data-ai-hint="soccer action" />
                                </div>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base font-semibold truncate">{video.title}</CardTitle>
                                    <CardDescription className="text-xs">{new Date((video.uploadDate as any).seconds * 1000).toLocaleDateString()}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">No highlight videos available for this player yet.</p>
            )}
        </div>
    );
}

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: playerId } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideosLoading, setIsVideosLoading] = useState(true);
  const [isNewsLoading, setIsNewsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!playerId) return;

    // Fetch Player Data
    const playerDocRef = doc(db, "players", playerId);
    const unsubscribePlayer = onSnapshot(playerDocRef, (doc) => {
      if (doc.exists()) {
        const playerData = { id: doc.id, ...doc.data() } as Player
        setPlayer(playerData);
        fetchPlayerNews(playerData.name);
      } else {
        setPlayer(null);
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching player:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch player."})
        setIsLoading(false);
    });

    const fetchPlayerNews = async (playerName: string) => {
        setIsNewsLoading(true);
        try {
            const newsQuery = query(collection(db, "news"), where("tags", "array-contains", playerName));
            const newsSnapshot = await getDocs(newsQuery);
            const newsData = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
            setNews(newsData);
        } catch (error) {
            console.error("Error fetching player news:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch player's news."})
        } finally {
            setIsNewsLoading(false);
        }
    }

    // Fetch Player's Videos
    const fetchPlayerVideos = async () => {
      setIsVideosLoading(true);
      try {
        const playerVideosQuery = query(collection(db, "playerVideos"), where("playerId", "==", playerId));
        const unsubscribe = onSnapshot(playerVideosQuery, async (playerVideosSnapshot) => {
            const videoIds = playerVideosSnapshot.docs.map(doc => doc.data().videoId);

            if (videoIds.length > 0) {
              const videosQuery = query(collection(db, "videos"), where(documentId(), "in", videoIds));
              const videosSnapshot = await getDocs(videosQuery);
              const videosData = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
              setVideos(videosData);
            } else {
              setVideos([]);
            }
            setIsVideosLoading(false);
        });
        return unsubscribe;
      } catch (error) {
          console.error("Error fetching player videos:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch player videos."})
          setIsVideosLoading(false);
      }
    };

    const unsubscribeVideos = fetchPlayerVideos();

    return () => {
      unsubscribePlayer();
      unsubscribeVideos?.then(unsub => unsub());
    }
  }, [playerId, toast]);


  if (isLoading) {
     return (
        <div className="flex h-[80vh] w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  if (!player) {
    notFound()
  }

  const getStatusVariant = (status?: string) => {
    switch (status) {
        case "Injured": return "destructive";
        case "On Loan": return "secondary";
        default: return "default";
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row gap-6 p-6">
          <Avatar className="h-32 w-32 border-4 border-primary/20">
            <AvatarImage src={player.imageUrl} alt={player.name} data-ai-hint="player portrait" />
            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-y-2">
              <h1 className="text-4xl font-headline font-bold">{player.name}</h1>
              <div className="flex items-center gap-2">
                {player.status && player.status !== "Active" && (
                    <Badge variant={getStatusVariant(player.status)} className="text-base">{player.status}</Badge>
                )}
                <Badge variant="secondary" className="text-lg">#{player.jerseyNumber}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <p className="text-xl text-primary font-semibold">{player.position}</p>
                {player.strongFoot && (
                    <>
                    <Separator orientation="vertical" className="h-5"/>
                    <div className="flex items-center gap-1.5 text-base">
                        <Footprints className="h-4 w-4"/>
                        <span>{player.strongFoot} Foot</span>
                    </div>
                    </>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bio" className="w-full">
            <TabsList className="grid w-full grid-cols-4 md:w-[600px]">
              <TabsTrigger value="bio"><User className="mr-2 h-4 w-4" />Bio</TabsTrigger>
              <TabsTrigger value="stats"><BarChart2 className="mr-2 h-4 w-4" />Stats</TabsTrigger>
              <TabsTrigger value="highlights"><Clapperboard className="mr-2 h-4 w-4" />Highlights ({videos.length})</TabsTrigger>
              <TabsTrigger value="news"><Newspaper className="mr-2 h-4 w-4" />News ({news.length})</TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="bio">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                  <h3 className="font-headline text-xl font-semibold mb-2">Biography</h3>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <p>{player.bio}</p>
                  </div>
                </div>
                {player.careerHighlights && player.careerHighlights.length > 0 && (
                  <div className="md:col-span-1">
                    <h3 className="font-headline text-lg font-semibold mb-2 flex items-center gap-2"><Medal className="text-accent h-5 w-5" />Career Highlights</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {player.careerHighlights.map((highlight, index) => (
                        <li key={index}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="stats">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Appearances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{player.stats.appearances}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Goals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{player.stats.goals}</p>

                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Assists</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{player.stats.assists}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="highlights">
              <PlayerHighlightsTab player={player} videos={videos} isLoading={isVideosLoading} />
            </TabsContent>
            <TabsContent value="news">
                {isNewsLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : news.length > 0 ? (
                    <div className="space-y-4">
                    {news.map((article) => (
                        <Card key={article.id}>
                            <CardHeader>
                                <CardTitle className="font-headline text-xl">{article.headline}</CardTitle>
                                <CardDescription>{new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                            </CardContent>
                             <CardFooter>
                                <Button asChild variant="link" className="p-0">
                                    <Link href="/news">Read More &rarr;</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">No news articles found mentioning this player.</p>
                )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
