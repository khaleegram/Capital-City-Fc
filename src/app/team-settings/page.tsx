"use client"

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getTeamProfile } from "@/lib/team";
import type { TeamProfile } from "@/lib/data";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";
import { TeamProfileForm } from "./_components/team-profile-form";
import { NotificationComposer } from "./_components/notification-composer";
import { Separator } from "@/components/ui/separator";
import { MaintenanceToggle } from "./_components/maintenance-toggle";

export default function TeamSettingsPage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<TeamProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Replaced the one-time fetch with a real-time listener
        // to ensure the UI updates automatically after changes.
        const profileDocRef = doc(db, "teamProfile", "main_profile");
        const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({
                    id: docSnap.id,
                    name: data.name,
                    logoUrl: data.logoUrl,
                    homeVenue: data.homeVenue,
                    maintenanceMode: data.maintenanceMode || false,
                });
            } else {
                // If the profile doesn't exist, create the default one.
                // This is unlikely to happen after first load but is good practice.
                getTeamProfile().then(setProfile);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Failed to fetch team profile in real-time:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (!user) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-[calc(100vh-10rem)]">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="font-headline">Admin Access Required</CardTitle>
                        <CardDescription>
                            You must be logged in to manage the team profile.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-headline font-bold">Team Profile Settings</h1>
                    <p className="text-muted-foreground mt-2">Manage your club's official name, logo, and other details.</p>
                </div>
                {profile && <TeamProfileForm profile={profile} />}
                
                <Separator />

                {profile && <MaintenanceToggle profile={profile} />}
                
                <Separator />
                
                <NotificationComposer />
            </div>
        </div>
    )
}
