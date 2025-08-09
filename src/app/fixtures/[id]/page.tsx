
"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Fixture, TeamProfile } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { getTeamProfile } from "@/lib/team"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { LiveUpdateForm } from "@/app/summaries/_components/live-update-form"
import { LiveMatchFeed } from "@/app/summaries/_components/live-match-feed"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


export default function FixtureDetailsPage({ params }: { params: { id: string }}) {
    const { toast } = useToast()
    const [fixture, setFixture] = useState<Fixture | null>(null)
    const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fixtureId = params.id;
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
    }, [params.id, toast]);

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
                        <span className="text-4xl font-bold">vs</span>
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

            <LiveUpdateForm fixtureId={fixture.id} />

            <Separator />
            
            <LiveMatchFeed fixtureId={fixture.id} />
        </div>
    )
}
