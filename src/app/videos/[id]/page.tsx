
"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Video } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Tag, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default function VideoPlayerPage({ params }: { params: { id: string } }) {
    const { toast } = useToast()
    const [video, setVideo] = useState<Video | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const videoId = params.id;
        if (!videoId) return;

        const docRef = doc(db, "videos", videoId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                setVideo({ id: doc.id, ...doc.data() } as Video);
            } else {
                setVideo(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching video:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch video." });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [params.id, toast]);

    if (isLoading) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!video) {
        notFound();
    }

    const uploadDate = (video.uploadDate as any)?.toDate ? (video.uploadDate as any).toDate() : new Date();

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <Card>
                <CardContent className="p-0">
                    <video
                        src={video.videoUrl}
                        controls
                        className="w-full aspect-video rounded-t-lg bg-black"
                        poster={video.thumbnailUrl}
                    >
                        Your browser does not support the video tag.
                    </video>
                </CardContent>
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">{video.title}</CardTitle>
                    <CardDescription>
                        Uploaded on {uploadDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-foreground">{video.description}</p>
                    {video.taggedPlayers && video.taggedPlayers.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                            <h3 className="font-semibold flex items-center gap-2 mb-3"><Tag className="h-4 w-4" /> Tagged Players</h3>
                            <div className="flex flex-wrap gap-2">
                                {video.taggedPlayers.map(player => (
                                    <Link href={`/players/${player.id}`} key={player.id}>
                                        <Badge variant="secondary" className="text-sm hover:bg-primary/10 transition-colors">
                                            <User className="mr-1.5 h-3 w-3" />
                                            {player.name}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
