
"use client"

import { useState, useEffect, use } from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { doc, onSnapshot, collection, query, where, getDocs, documentId } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Player, Video } from "@/lib/data"

import { BarChart2, Clapperboard, Medal, User, Loader2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: playerId } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideosLoading, setIsVideosLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!playerId) return;

    // Fetch Player Data
    const playerDocRef = doc(db, "players", playerId);
    const unsubscribePlayer = onSnapshot(playerDocRef, (doc) => {
      if (doc.exists()) {
        setPlayer({ id: doc.id, ...doc.data() } as Player);
      } else {
        setPlayer(null);
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching player:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch player."})
        setIsLoading(false);
    });

    // Fetch Player's Videos
    const fetchPlayerVideos = async () => {
      setIsVideosLoading(true);
      try {
        const playerVideosQuery = query(collection(db, "playerVideos"), where("playerId", "==", playerId));
        const playerVideosSnapshot = await getDocs(playerVideosQuery);
        const videoIds = playerVideosSnapshot.docs.map(doc => doc.data().videoId);

        if (videoIds.length > 0) {
          const videosQuery = query(collection(db, "videos"), where(documentId(), "in", videoIds));
          const videosSnapshot = await getDocs(videosQuery);
          const videosData = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
          setVideos(videosData);
        } else {
          setVideos([]);
        }
      } catch (error) {
          console.error("Error fetching player videos:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch player videos."})
      } finally {
        setIsVideosLoading(false);
      }
    };

    fetchPlayerVideos();

    return () => unsubscribePlayer();
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row gap-6 p-6">
          <Avatar className="h-32 w-32 border-4 border-primary/20">
            <AvatarImage src={player.imageUrl} alt={player.name} data-ai-hint="player portrait" />
            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-headline font-bold">{player.name}</h1>
              <Badge variant="secondary" className="text-lg">#{player.jerseyNumber}</Badge>
            </div>
            <p className="text-xl text-primary font-semibold mt-1">{player.position}</p>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bio" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
              <TabsTrigger value="bio"><User className="mr-2 h-4 w-4" />Bio</TabsTrigger>
              <TabsTrigger value="stats"><BarChart2 className="mr-2 h-4 w-4" />Stats</TabsTrigger>
              <TabsTrigger value="videos"><Clapperboard className="mr-2 h-4 w-4" />Videos ({videos.length})</TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="bio">
              <div className="prose prose-sm max-w-none text-foreground">
                <p>{player.bio}</p>
              </div>
              
              {player.careerHighlights && player.careerHighlights.length > 0 && (
                <>
                  <h3 className="font-headline text-lg font-semibold mt-6 mb-2 flex items-center gap-2"><Medal className="text-accent h-5 w-5" />Career Highlights</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {player.careerHighlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                </>
              )}
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
            <TabsContent value="videos">
              {isVideosLoading ? (
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
                <p className="text-muted-foreground text-center py-8">No videos available for this player.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
