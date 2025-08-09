
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { LiveEvent } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Radio } from "lucide-react"

interface LiveMatchFeedProps {
    fixtureId: string;
}

export function LiveMatchFeed({ fixtureId }: LiveMatchFeedProps) {
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
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : updates.length > 0 ? (
                    <div className="space-y-6 border-l-2 border-primary/20 pl-6 relative">
                         {updates.map((update) => (
                             <div key={update.id} className="relative">
                                <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-primary" />
                                <p className="text-sm font-semibold">{update.text}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {update.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                         ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">Waiting for the match to begin...</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
