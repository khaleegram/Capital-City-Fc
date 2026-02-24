
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import type { Video, Player } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { VideoForm } from "./_components/video-form"
import Link from "next/link"
import { deleteVideo } from "@/lib/videos"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusCircle, Search, Video as VideoIcon, Loader2, Edit, Trash2 } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function VideosPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [videos, setVideos] = useState<Video[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [videoToEdit, setVideoToEdit] = useState<Video | null>(null);
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

  const handleAddNew = () => {
    setVideoToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (video: Video) => {
    setVideoToEdit(video);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (video: Video) => {
    try {
        await deleteVideo(video);
        toast({ title: "Success", description: "Video deleted successfully." });
    } catch (error) {
        console.error("Error deleting video:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete video." });
    }
  };

  const filteredVideos = videos.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {user && 
        <VideoForm
          isOpen={isFormOpen}
          setIsOpen={setIsFormOpen}
          players={players}
          videoToEdit={videoToEdit}
        />
      }
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-headline font-bold">Video Library</h1>
            <p className="text-muted-foreground mt-2">Manage, upload, and tag player videos.</p>
        </div>
        {user && (
            <Button onClick={handleAddNew}>
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
                 <Button onClick={handleAddNew} className="mt-6">
                    <PlusCircle className="mr-2" />
                    Upload First Video
                </Button>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <div key={video.id} className="relative group/video">
                <Link href={`/videos/${video.id}`} className="block h-full">
                <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
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
                    <CardContent className="p-4 pt-0 flex-grow flex items-end">
                        {video.taggedPlayers && video.taggedPlayers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs font-semibold mr-1">Tagged:</span>
                            {video.taggedPlayers.map(p => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
                        </div>
                        ) : (
                        <p className="text-xs text-muted-foreground">No players tagged.</p>
                        )}
                    </CardContent>
                </Card>
                </Link>
                {user && (
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/video:opacity-100 transition-opacity">
                        <Button size="icon" variant="outline" className="h-8 w-8 bg-background/80" onClick={() => handleEdit(video)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="icon" variant="destructive" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete this video and its files. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(video)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
