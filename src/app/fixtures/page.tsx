
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import type { Fixture } from "@/lib/data"
import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar } from "lucide-react"
import { FixtureForm } from "./_components/fixture-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function FixtureCard({ fixture }: { fixture: Fixture }) {
    const fixtureDate = (fixture.date as any).toDate ? (fixture.date as any).toDate() : new Date(fixture.date);

    return (
        <Link href={`/fixtures/${fixture.id}`} className="block">
            <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-4">
                        <span>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(fixtureDate)}</span>
                        <span>{fixture.competition}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                            <Avatar>
                                <AvatarImage src="/logo.png" alt="Capital City FC" data-ai-hint="team logo" />
                                <AvatarFallback>CC</AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-lg font-headline">Capital City FC</span>
                        </div>
                        <div className="text-center px-4">
                            <span className="font-bold text-2xl">vs</span>
                        </div>
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <span className="font-bold text-lg font-headline text-right">{fixture.opponent}</span>
                            <Avatar>
                                <AvatarImage src={fixture.opponentLogoUrl} alt={fixture.opponent} data-ai-hint="team logo" />
                                <AvatarFallback>{fixture.opponent.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export default function FixturesPage() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [fixtures, setFixtures] = useState<Fixture[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const q = query(collection(db, "fixtures"), orderBy("date", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fixture));
            setFixtures(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching fixtures:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch fixtures." })
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Fixtures & Results</h1>
                    <p className="text-muted-foreground mt-2">View upcoming matches and generate previews.</p>
                </div>
                {user && <FixtureForm />}
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : fixtures.length > 0 ? (
                    fixtures.map(fixture => (
                        <FixtureCard key={fixture.id} fixture={fixture} />
                    ))
                ) : (
                    <div className="text-center py-16 rounded-lg bg-muted">
                        <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">No Upcoming Fixtures</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {user ? "Add a new fixture to get started." : "Check back later for the match schedule."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
