
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import type { Video, Player } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { VideoForm } from "./_components/video-form"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusCircle, Search, Video as VideoIcon, Loader2 } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default function VideosPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [videos, setVideos] = useState<Video[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const videosQuery = query(collection(db, "videos"), orderBy("uploadDate", "desc"));
    const videosUnsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
      setVideos(videosData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching videos:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch videos." });
      setIsLoading(false);
    });

    const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
    const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
        const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setPlayers(playersData);
    }, (error) => {
        console.error("Error fetching players for tagging:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch players for tagging." });
    });

    return () => {
      videosUnsubscribe();
      playersUnsubscribe();
    };
  }, [toast]);

  const filteredVideos = videos.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <VideoForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        players={players}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-headline font-bold">Video Library</h1>
            <p className="text-muted-foreground mt-2">Manage, upload, and tag player videos.</p>
        </div>
        {user && (
            <Button onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2" />
                Add New Video
            </Button>
        )}
      </div>

       <div className="mb-6 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search videos..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16">
            <VideoIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Videos Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try a different search term." : "There are no videos in the library yet."}
            </p>
            {user && !searchQuery && (
                 <Button onClick={() => setIsFormOpen(true)} className="mt-6">
                    <PlusCircle className="mr-2" />
                    Upload First Video
                </Button>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-video">
                <Image
                  src={video.thumbnailUrl || 'https://placehold.co/400x225.png'}
                  alt={video.title}
                  fill
                  className="object-cover"
                  data-ai-hint="soccer action"
                />
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-lg font-semibold truncate">{video.title}</CardTitle>
                <CardDescription className="truncate h-5">{video.description}</CardDescription>
              </CardHeader>
               <CardContent className="p-4 pt-0">
                  {video.taggedPlayers && video.taggedPlayers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-semibold mr-1">Tagged:</span>
                        {video.taggedPlayers.map(p => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No players tagged.</p>
                  )}
              </CardContent>
            </Card>>
          ))}
        </div>
      )}
    </div>
  )
}
