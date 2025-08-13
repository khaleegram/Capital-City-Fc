"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, query, where, getDocs, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { answerScoutQuestion } from "@/ai/flows/answer-scout-questions"
import type { Player, NewsArticle } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Wand2 } from "lucide-react"

export function PlayerInsights() {
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("")
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [answer, setAnswer] = useState("")

  useEffect(() => {
    setIsLoading(true)
    const q = query(collection(db, "players"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerate = async () => {
    if (!selectedPlayerId || !question) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a player and enter a question.",
      })
      return;
    }

    setIsGenerating(true)
    setAnswer("")

    try {
      const selectedPlayer = players.find(p => p.id === selectedPlayerId);
      if (!selectedPlayer) throw new Error("Player not found");

      // Fetch relevant news articles
      const newsQuery = query(collection(db, "news"), where("tags", "array-contains", selectedPlayer.name));
      const newsSnapshot = await getDocs(newsQuery);
      const newsArticles = newsSnapshot.docs.map(doc => doc.data() as NewsArticle);

      const result = await answerScoutQuestion({
        playerProfile: JSON.stringify(selectedPlayer),
        newsArticles: JSON.stringify(newsArticles),
        question: question,
      });

      setAnswer(result.answer);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate insights." });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Generate Scout Report</CardTitle>
        <CardDescription>Select a player and ask a question to get an AI-generated analysis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="player-select">Player</Label>
            <Select onValueChange={setSelectedPlayerId} value={selectedPlayerId} disabled={isLoading}>
              <SelectTrigger id="player-select">
                <SelectValue placeholder={isLoading ? "Loading players..." : "Select a player"} />
              </SelectTrigger>
              <SelectContent>
                {players.map(player => (
                  <SelectItem key={player.id} value={player.id}>{player.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., How does this player perform under pressure in late-game situations?"
              rows={3}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isGenerating || isLoading}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Generate Insights
        </Button>
        
        {isGenerating && (
            <div className="flex items-center space-x-2 text-muted-foreground pt-4">
                <Loader2 className="h-5 w-5 animate-spin"/>
                <span>Analyzing data and generating report...</span>
            </div>
        )}

        {answer && (
          <div className="pt-6 border-t">
            <h3 className="font-semibold text-lg mb-2 font-headline">Generated Report</h3>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
