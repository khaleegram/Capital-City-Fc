
"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import type { Fixture, TeamProfile } from "@/lib/data"
import Link from "next/link"
import { getTeamProfile } from "@/lib/team"
import { deleteFixture } from "@/lib/fixtures"

import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Calendar, Edit, Trash2, PlusCircle } from "lucide-react"
import { FixtureForm } from "./_components/fixture-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function FixtureCard({ fixture, teamProfile, onEdit, onDelete }: { fixture: Fixture, teamProfile: TeamProfile, onEdit: (fixture: Fixture) => void, onDelete: (fixture: Fixture) => void }) {
    const { user } = useAuth()
    const fixtureDate = (fixture.date as any).toDate ? (fixture.date as any).toDate() : new Date(fixture.date);

    const getStatusBadge = () => {
        switch (fixture.status) {
            case "LIVE":
                return <Badge variant="destructive" className="flex items-center gap-1.5"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span> LIVE</Badge>;
            case "FT":
                return <Badge className="bg-green-600">FT</Badge>;
            case "UPCOMING":
            default:
                return <Badge variant="secondary">UPCOMING</Badge>;
        }
    }

    return (
        <div className="relative group/fixture">
            <Link href={`/fixtures/${fixture.id}`} className="block">
                <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-4">
                            <span>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(fixtureDate)}</span>
                            <div className="flex items-center gap-2">
                            <span>{fixture.competition}</span>
                            {getStatusBadge()}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <Avatar>
                                    <AvatarImage src={teamProfile.logoUrl} alt={teamProfile.name} data-ai-hint="team logo" />
                                    <AvatarFallback>{teamProfile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-lg font-headline">{teamProfile.name}</span>
                            </div>
                            <div className="text-center px-4">
                                <span className="font-bold text-2xl">{fixture.status === 'UPCOMING' || !fixture.score ? 'vs' : `${fixture.score.home} - ${fixture.score.away}`}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-1 justify-end">
                                <span className="font-bold text-lg font-headline text-right">{fixture.opponent}</span>
                                <Avatar>
                                    <AvatarImage src={fixture.opponentLogoUrl} alt={fixture.opponent} data-ai-hint="team logo" />
                                    <AvatarFallback>{fixture.opponent.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-3">{fixture.venue}</div>
                    </CardContent>
                </Card>
            </Link>
            {user && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/fixture:opacity-100 transition-opacity">
                    <Button size="icon" variant="outline" className="h-8 w-8 bg-background/80" onClick={() => onEdit(fixture)}>
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
                                    This will permanently delete the fixture and its associated preview article. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(fixture)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    )
}

export default function FixturesPage() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [fixtures, setFixtures] = useState<Fixture[]>([])
    const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

    useEffect(() => {
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

        const q = query(collection(db, "fixtures"), orderBy("date", "desc"));
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

    const handleAddNew = () => {
        setSelectedFixture(null);
        setIsFormOpen(true);
    };

    const handleEdit = (fixture: Fixture) => {
        setSelectedFixture(fixture);
        setIsFormOpen(true);
    };

    const handleDelete = async (fixture: Fixture) => {
        try {
            await deleteFixture(fixture);
            toast({ title: "Success", description: "Fixture and associated article deleted." });
        } catch (error) {
            console.error("Error deleting fixture:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete fixture." });
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <FixtureForm isOpen={isFormOpen} setIsOpen={setIsFormOpen} fixture={selectedFixture} />
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Fixtures & Results</h1>
                    <p className="text-muted-foreground mt-2">View upcoming matches and generate previews.</p>
                </div>
                {user && <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2" /> Add New Fixture
                </Button>}
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : fixtures.length > 0 && teamProfile ? (
                    fixtures.map(fixture => (
                        <FixtureCard key={fixture.id} fixture={fixture} teamProfile={teamProfile} onEdit={handleEdit} onDelete={handleDelete} />
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
