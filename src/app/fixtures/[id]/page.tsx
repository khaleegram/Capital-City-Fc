
"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Fixture } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { LiveUpdateForm } from "@/app/summaries/_components/live-update-form"
import { LiveMatchFeed } from "@/app/summaries/_components/live-match-feed"


export default function FixtureDetailsPage({ params }: { params: { id: string }}) {
    const { toast } = useToast()
    const [fixture, setFixture] = useState<Fixture | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!params.id) return;

        const docRef = doc(db, "fixtures", params.id);
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

    if (isLoading) {
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
                        <CardTitle className="font-headline text-3xl">Capital City FC vs. {fixture.opponent}</CardTitle>
                        <Badge variant="secondary" className="text-base">{fixture.competition}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 pt-2">
                        <Calendar className="h-4 w-4"/>
                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(fixtureDate)}
                    </CardDescription>
                </CardHeader>
            </Card>

            <LiveUpdateForm fixtureId={fixture.id} />

            <Separator />
            
            <LiveMatchFeed fixtureId={fixture.id} />
        </div>
    )
}
