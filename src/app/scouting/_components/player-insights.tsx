
"use client"

import { useState, useEffect } from "react"
import { Loader2, Sparkles, ChevronsUpDown, Check } from "lucide-react"
import { answerPlayerQuestion } from "@/ai/flows/answer-player-questions"
import { NewsArticle, Player } from "@/lib/data"
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function PlayerInsights() {
  const [players, setPlayers] = useState<Player[]>([])
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const { toast } = useToast()

   useEffect(() => {
    const playersQuery = query(collection(db, "players"));
    const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
    }, (error) => {
      console.error("Error fetching players:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch players for scouting."})
    });

    const newsQuery = query(collection(db, "news"));
    const newsUnsubscribe = onSnapshot(newsQuery, (snapshot) => {
        const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
        setNewsArticles(articlesData);
    }, (error) => {
        console.error("Error fetching news:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch news articles for scouting."})
    });

    return () => {
        playersUnsubscribe();
        newsUnsubscribe();
    };
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

    const playerProfile = `Name: ${player.name}, Position: ${
      player.position
    }, Bio: ${player.bio}, Stats: ${JSON.stringify(player.stats)}`
    
    const relevantNews = newsArticles
      .map((article) => `Headline: ${article.headline}\nContent: ${article.content}`)
      .join("\n\n---\n\n")

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

  const selectedPlayerName = players.find(p => p.id === selectedPlayerId)?.name || "Select a player...";

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
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isPopoverOpen}
                    className="w-full justify-between"
                    disabled={isLoading || players.length === 0}
                  >
                    {selectedPlayerName}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search player..." />
                    <CommandList>
                      <CommandEmpty>No player found.</CommandEmpty>
                      <CommandGroup>
                        {players.map((player) => (
                          <CommandItem
                            key={player.id}
                            value={player.name}
                            onSelect={() => {
                              setSelectedPlayerId(player.id)
                              setIsPopoverOpen(false)
                            }}
                          >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPlayerId === player.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {player.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
