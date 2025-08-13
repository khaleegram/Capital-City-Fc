"use client"

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, LayoutDashboard } from "lucide-react";
import { FormationManager } from "./_components/formation-manager";

export default function FormationsPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-[calc(100vh-10rem)]">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="font-headline">Admin Access Required</CardTitle>
                        <CardDescription>
                            You must be logged in to manage team formations.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <LayoutDashboard className="h-8 w-8 text-primary"/>
                        Formation Manager
                    </h1>
                    <p className="text-muted-foreground mt-2">Create and manage reusable team lineups for matches.</p>
                </div>
            </div>
            <FormationManager />
        </div>
    )
}
