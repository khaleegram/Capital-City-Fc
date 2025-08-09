
"use client"

import { useState, useEffect } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { answerPlayerQuestion } from "@/ai/flows/answer-player-questions"
import { newsArticles, Player } from "@/lib/data"
import { collection, onSnapshot, query } from "firebase/firestore"
import { db } from "@/lib/firebase"


import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

export function PlayerInsights() {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

   useEffect(() => {
    const q = query(collection(db, "players"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
    }, (error) => {
      console.error("Error fetching players:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch players for scouting."})
    });
    return () => unsubscribe();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlayerId || !question.trim()) return

    setIsLoading(true)
    setAnswer("")

    const player = players.find((p) => p.id === selectedPlayerId)
    if (!player) {
      setIsLoading(false)
      return
    }

    // In a real app, you would fetch relevant news articles for the player
    const playerProfile = `Name: ${player.name}, Position: ${
      player.position
    }, Bio: ${player.bio}, Stats: ${JSON.stringify(player.stats)}`
    const relevantNews = newsArticles
      .map((article) => article.content)
      .join("\n\n")

    try {
      const result = await answerPlayerQuestion({
        playerProfile: playerProfile,
        newsArticles: relevantNews,
        question: question,
      })
      setAnswer(result.answer)
    } catch (error) {
      console.error(error)
      setAnswer("Sorry, I couldn't find an answer to your question.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Scouting Assistant</CardTitle>
        <CardDescription>
          Select a player and ask a question to get an AI-powered analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="player-select">Player</Label>
              <Select
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
                disabled={isLoading || players.length === 0}
              >
                <SelectTrigger id="player-select">
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question">Your Question</Label>
            <Input
              id="question"
              placeholder="e.g., What are their key strengths in high-pressure games?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !selectedPlayerId || !question.trim()}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Get Insights
          </Button>
        </form>

        {(isLoading || answer) && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold font-headline">Analysis</h3>
            <div className="mt-2 rounded-md bg-muted p-4 text-sm">
                {isLoading ? (
                    <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>Analyzing player data...</span>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap font-body">{answer}</p>
                )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
