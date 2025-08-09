
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import type { Fixture } from "@/lib/data"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Calendar } from "lucide-react"
import { FixtureForm } from "./_components/fixture-form"

function FixtureCard({ fixture }: { fixture: Fixture }) {
    const fixtureDate = (fixture.date as any).toDate ? (fixture.date as any).toDate() : new Date(fixture.date);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-headline text-xl">{fixture.opponent}</CardTitle>
                <Badge variant="outline">{fixture.competition}</Badge>
            </CardHeader>
            <CardContent>
                <div className="text-sm text-muted-foreground">
                    <p>{new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(fixtureDate)}</p>
                    <p>{fixture.venue}</p>
                </div>
            </CardContent>
        </Card>
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

            <div className="space-y-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : fixtures.length > 0 ? (
                    fixtures.map(fixture => (
                        <FixtureCard key={fixture.id} fixture={fixture} />
                    ))
                ) : (
                    <div className="text-center py-16">
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
