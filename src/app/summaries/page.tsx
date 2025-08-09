
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Info } from "lucide-react"

export default function SummariesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-[calc(100vh-10rem)]">
        <Card className="max-w-md w-full">
            <CardHeader className="text-center">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="font-headline">Live Summaries Moved</CardTitle>
                <CardDescription>
                    Live match updates are now available on the individual fixture pages. 
                    Please navigate to the Fixtures page to select a match.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  )
}
