
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, FileText, Newspaper, Users } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MonthlyGoalChart } from "./_components/monthly-goal-chart"
import { useAuth } from "@/hooks/use-auth"
import { newsArticles } from "@/lib/data"
import { useState, useEffect } from "react"
import { Player } from "@/lib/data"
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function AdminDashboard() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">News Articles</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125</div>
            <p className="text-xs text-muted-foreground">+15 this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Summaries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38</div>
            <p className="text-xs text-muted-foreground">Season total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scouting Reports</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73</div>
            <p className="text-xs text-muted-foreground">+5 new reports</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <MonthlyGoalChart />
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Recent News</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Capital City Triumphs in Derby</h3>
                  <p className="text-sm text-muted-foreground">A thrilling 2-1 victory against our rivals...</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Star Striker Signs Extension</h3>
                  <p className="text-sm text-muted-foreground">Leo Rivera commits to three more years...</p>
                </div>
                 <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Youth Academy Promotions</h3>
                  <p className="text-sm text-muted-foreground">Three promising talents join the first team...</p>
                </div>
                 <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PublicLandingPage() {
  const [featuredPlayers, setFeaturedPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Fetch a few players to feature
    const q = query(collection(db, "players"), orderBy("name", "asc"), limit(3));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setFeaturedPlayers(playersData);
    });

    return () => unsubscribe();
  }, []);

  const recentNews = newsArticles.slice(0, 2);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[60vh] bg-cover bg-center text-white flex items-center justify-center">
        <Image 
          src="https://placehold.co/1600x900.png" 
          alt="Capital City FC Stadium" 
          layout="fill" 
          objectFit="cover" 
          className="z-0 opacity-40" 
          data-ai-hint="stadium lights"
        />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-5xl md:text-7xl font-headline font-bold drop-shadow-lg">Capital City FC</h1>
          <p className="mt-4 text-xl md:text-2xl font-light drop-shadow-md">Pride of the Capital</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/players">Meet the Team</Link>
          </Button>
        </div>
      </section>
      
      {/* Recent News Section */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-headline font-bold text-center mb-8">Latest News</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {recentNews.map(article => (
              <Card key={article.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="font-headline text-2xl">{article.headline}</CardTitle>
                  <CardDescription>{article.date}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3">{article.content}</p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="link" className="p-0">
                    <Link href="/news">Read More &rarr;</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
           <div className="text-center mt-8">
             <Button asChild>
                <Link href="/news">View All News</Link>
             </Button>
           </div>
        </div>
      </section>

      {/* Featured Players Section */}
      {featuredPlayers.length > 0 && (
        <section className="py-12 bg-muted">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-headline font-bold text-center mb-8">Meet the Players</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {featuredPlayers.map(player => (
                <Link href={`/players/${player.id}`} key={player.id} className="block">
                  <Card className="text-center overflow-hidden transform hover:-translate-y-2 transition-transform">
                    <div className="aspect-square relative">
                      <Image 
                        src={player.imageUrl} 
                        alt={player.name} 
                        layout="fill" 
                        objectFit="cover" 
                        data-ai-hint="player portrait"
                      />
                    </div>
                    <CardHeader>
                      <CardTitle className="font-headline text-2xl">{player.name}</CardTitle>
                      <CardDescription>{player.position}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button asChild variant="secondary">
                <Link href="/players">View Full Roster</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}


export default function HomePage() {
  const { user } = useAuth()

  return user ? <AdminDashboard /> : <PublicLandingPage />;
}
