
"use client"

import { useState } from "react"
import { generateMatchSummary } from "@/ai/flows/generate-match-summary"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, Send, Mic } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface LiveUpdateFormProps {
    fixtureId: string;
}

export function LiveUpdateForm({ fixtureId }: LiveUpdateFormProps) {
  const { user } = useAuth()
  const [note, setNote] = useState("")
  const [enhancedUpdate, setEnhancedUpdate] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!note.trim()) return
    setIsGenerating(true)
    setEnhancedUpdate("")
    try {
      const result = await generateMatchSummary({ note })
      setEnhancedUpdate(result.update)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate update. Please try again.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePostUpdate = async () => {
    if (!enhancedUpdate.trim()) return;
    setIsPosting(true);
    try {
        const liveEventsRef = collection(db, "fixtures", fixtureId, "liveEvents");
        await addDoc(liveEventsRef, {
            text: enhancedUpdate,
            timestamp: serverTimestamp(),
            type: "Info", // This could be enhanced to be dynamic
        });
        toast({ title: "Success", description: "Live update posted!" });
        setNote("");
        setEnhancedUpdate("");
    } catch(error) {
        console.error("Error posting update:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to post update."});
    } finally {
        setIsPosting(false);
    }
  }
  
  // Hide component if not logged in
  if (!user) return null;

  return (
    <Card className="border-primary border-2">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Mic className="text-primary"/> Admin: Post Live Update</CardTitle>
        <CardDescription>Enter a short note, enhance it with AI, and post it to the live feed for this match.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="note">Match Note</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Rivera goal 55m, Smith yellow card"
            className="mt-1"
            disabled={isGenerating || isPosting}
          />
           <Button onClick={handleGenerate} disabled={isGenerating || !note.trim()} className="mt-2">
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Enhance with AI
          </Button>
        </div>
        
        {enhancedUpdate && (
            <div className="space-y-2">
                <Label htmlFor="enhanced-update">Generated Update (Editable)</Label>
                <Textarea 
                    id="enhanced-update"
                    value={enhancedUpdate}
                    onChange={(e) => setEnhancedUpdate(e.target.value)}
                    className="bg-muted"
                    rows={3}
                />
                <Button onClick={handlePostUpdate} disabled={isPosting}>
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Post to Live Feed
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  )
}
