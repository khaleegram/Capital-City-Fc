
"use client"

import { RecapGenerator } from "./_components/recap-generator"
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default function RecapsPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-[calc(100vh-10rem)]">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="font-headline">Admin Access Required</CardTitle>
                        <CardDescription>
                            You must be logged in to access the match recap tools.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
       <div>
        <h1 className="text-3xl font-headline font-bold">Post-Match Recap Generator</h1>
        <p className="text-muted-foreground mt-2">Select a fixture and enter notes to generate a full match report.</p>
      </div>
      <RecapGenerator />
    </div>
  )
}
