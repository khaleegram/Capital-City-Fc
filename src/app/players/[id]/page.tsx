
"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore"
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

export default function PlayerProfilePage({ params }: { params: { id: string } }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideosLoading, setIsVideosLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!params.id) return;

    // Fetch Player Data
    const playerDocRef = doc(db, "players", params.id);
    const unsubscribePlayer = onSnapshot(playerDocRef, (doc) => {
      if (doc.exists()) {
        setPlayer({ id: doc.id, ...doc.data() } as Player);
      } else {
        setPlayer(null);
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching player:", error);
        setIsLoading(false);
    });

    // Fetch Player's Videos
    const fetchPlayerVideos = async () => {
      setIsVideosLoading(true);
      try {
        const tagsQuery = query(collection(db, "playerVideos"), where("playerId", "==", params.id));
        const tagsSnapshot = await getDocs(tagsQuery);
        const videoIds = tagsSnapshot.docs.map(doc => doc.data().videoId);

        if (videoIds.length > 0) {
          const videosQuery = query(collection(db, "videos"), where("__name__", "in", videoIds));
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
  }, [params.id, toast]);


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
          <Tabs defaultValue="bio">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid md:grid-cols-3">
              <TabsTrigger value="bio"><User className="mr-2" />Bio</TabsTrigger>
              <TabsTrigger value="stats"><BarChart2 className="mr-2" />Stats</TabsTrigger>
              <TabsTrigger value="videos"><Clapperboard className="mr-2" />Videos</TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="bio" className="prose prose-sm max-w-none text-foreground">
              <p>{player.bio}</p>
              <h3 className="font-headline text-lg font-semibold mt-6 mb-2 flex items-center gap-2"><Medal className="text-accent" />Career Highlights</h3>
              <ul className="list-disc pl-5 space-y-1">
                {player.careerHighlights && player.careerHighlights.map((highlight, index) => (
                  <li key={index}>{highlight}</li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="stats">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Appearances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.appearances}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Goals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.goals}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Assists</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.assists}</p>
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
                     <Link href={`/videos`} key={video.id}>
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="relative aspect-video">
                           <Image src={video.thumbnailUrl || 'https://placehold.co/400x225.png'} alt={video.title} fill className="object-cover" data-ai-hint="soccer action" />
                        </div>
                        <CardHeader className="p-3">
                          <CardTitle className="text-base font-semibold truncate">{video.title}</CardTitle>
                          <CardDescription className="text-xs">{new Date(video.uploadDate.seconds * 1000).toLocaleDateString()}</CardDescription>
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
