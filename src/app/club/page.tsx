
"use client"

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Player, TeamProfile } from "@/lib/data";
import { getTeamProfile } from "@/lib/team";
import { useToast } from "@/hooks/use-toast";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Users, MapPin } from "lucide-react";

function PlayerCard({ player }: { player: Player }) {
    return (
        <Link href={`/players/${player.id}`} className="block group">
            <Card className="h-full flex flex-col items-center justify-center text-center p-4 transition-all hover:shadow-lg hover:-translate-y-1">
                <Avatar className="h-24 w-24 border-4 border-muted group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={player.imageUrl} alt={player.name} />
                    <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <CardHeader className="p-2 pb-0">
                    <CardTitle className="font-headline text-xl mt-2">{player.name}</CardTitle>
                    <CardDescription>{player.position}</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                    <Badge variant="secondary">#{player.jerseyNumber}</Badge>
                </CardContent>
            </Card>
        </Link>
    )
}

function StaffCard({ member }: { member: Player }) {
     return (
        <Card className="p-4 flex flex-col items-center text-center">
             <Avatar className="h-24 w-24">
                <AvatarImage src={member.imageUrl} alt={member.name} />
                <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h3 className="font-bold mt-3">{member.name}</h3>
            <p className="text-sm text-muted-foreground">{member.position}</p>
        </Card>
    )
}


export default function ClubPage() {
    const [profile, setProfile] = useState<TeamProfile | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [staff, setStaff] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const teamProfile = await getTeamProfile();
                setProfile(teamProfile);
            } catch (error) {
                console.error("Failed to fetch team profile:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load team profile." });
            }
        };

        const playersQuery = query(collection(db, "players"), orderBy("role", "asc"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
            const allMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            setPlayers(allMembers.filter(m => m.role === 'Player'));
            setStaff(allMembers.filter(m => m.role === 'Coach' || m.role === 'Staff'));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching club members:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch club members." });
            setIsLoading(false);
        });

        fetchProfile();
        return () => unsubscribe();
    }, [toast]);

    if (isLoading || !profile) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-12">
            <section className="relative text-center py-20 rounded-lg overflow-hidden bg-muted">
                 <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${profile.logoUrl})` }}></div>
                <div className="relative z-10 flex flex-col items-center">
                    <Avatar className="h-28 w-28 mb-4 border-4 border-background shadow-lg">
                        <AvatarImage src={profile.logoUrl} alt={profile.name} />
                        <AvatarFallback>{profile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h1 className="text-5xl font-headline font-bold">{profile.name}</h1>
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{profile.homeVenue}</span>
                    </div>
                </div>
            </section>
            
            <section>
                <h2 className="text-3xl font-headline font-bold mb-6 flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    First Team Squad
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {players.map(player => (
                        <PlayerCard key={player.id} player={player} />
                    ))}
                </div>
            </section>

             {staff.length > 0 && (
                <section>
                    <h2 className="text-3xl font-headline font-bold mb-6 flex items-center gap-3">
                        <User className="h-8 w-8 text-primary" />
                        Coaching & Staff
                    </h2>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {staff.map(member => (
                            <StaffCard key={member.id} member={member} />
                        ))}
                    </div>
                </section>
            )}

        </div>
    )
}
