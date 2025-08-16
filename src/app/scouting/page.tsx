
"use client"

import { PlayerInsights } from "./_components/player-insights";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, Lock } from "lucide-react";

export default function ScoutingPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-[calc(100vh-10rem)]">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="font-headline">Admin Access Required</CardTitle>
                        <CardDescription>
                            You must be logged in to access the scouting tools.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary"/>
                        AI Scouting Assistant
                    </h1>
                    <p className="text-muted-foreground mt-2">Get deep insights on players by asking specific questions.</p>
                </div>
                <PlayerInsights />
            </div>
        </div>
    )
}
