
"use client"

import { useState, useEffect } from "react"
import { Bot, Send, X, Loader2 } from "lucide-react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { answerFanQuestion } from "@/ai/flows/answer-fan-questions"
import type { Player, NewsArticle } from "@/lib/data"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Message {
  id: number
  text: string
  sender: "user" | "bot"
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you with Capital City Hub today?", sender: "bot" }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // State to hold the context data
  const [players, setPlayers] = useState<Player[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isContextLoading, setIsContextLoading] = useState(true);

  useEffect(() => {
    const fetchContextData = async () => {
      if (!isOpen) return;
      setIsContextLoading(true);
      try {
        const playersSnapshot = await getDocs(collection(db, "players"));
        const playersData = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setPlayers(playersData);

        const newsSnapshot = await getDocs(collection(db, "news"));
        const newsData = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
        setNews(newsData);

      } catch (error) {
        console.error("Failed to fetch context data for chatbot:", error);
      } finally {
        setIsContextLoading(false);
      }
    }
    fetchContextData();
  }, [isOpen]);


  const handleSend = async () => {
    if (input.trim() === "" || isContextLoading) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
        const result = await answerFanQuestion({
            question: input,
            players: JSON.stringify(players),
            newsArticles: JSON.stringify(news)
        });
        const botResponse: Message = { id: Date.now() + 1, text: result.answer, sender: "bot" };
        setMessages((prev) => [...prev, botResponse]);

    } catch(error) {
        console.error("Error getting response from AI:", error);
        const botResponse: Message = { 
            id: Date.now() + 1, 
            text: "Sorry, I'm having a little trouble connecting right now. Please try again in a moment.", 
            sender: "bot" 
        };
        setMessages((prev) => [...prev, botResponse]);
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] h-[70vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="font-headline flex items-center gap-2">
              <Bot className="text-primary" /> Capital City Assistant
            </DialogTitle>
             <DialogDescription className="sr-only">A chatbot to assist with Capital City Hub.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender === "bot" && (
                    <Avatar className="h-8 w-8">
                       <AvatarImage data-ai-hint="robot illustration" src="https://placehold.co/40x40.png" />
                      <AvatarFallback>BOT</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
               {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                   <Avatar className="h-8 w-8">
                       <AvatarImage data-ai-hint="robot illustration" src="https://placehold.co/40x40.png" />
                      <AvatarFallback>BOT</AvatarFallback>
                    </Avatar>
                  <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a player..."
                className="flex-1"
                disabled={isLoading || isContextLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || isContextLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Chatbot"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </Button>
      </div>
    </>
  )
}
