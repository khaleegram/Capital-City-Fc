
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { BarChart, FileText, Newspaper, Users, Calendar, Shield, Trophy, Home, Building, Video } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MonthlyGoalChart } from "./_components/monthly-goal-chart"
import { useAuth } from "@/hooks/use-auth"
import { NewsArticle, Player, Fixture, TeamProfile } from "@/lib/data"
import { useState, useEffect } from "react"
import { collection, onSnapshot, query, orderBy, limit, getCountFromServer, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getTeamProfile } from "@/lib/team"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"

const publicMenuItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/club", label: "Club", icon: Building },
  { href: "/players", label: "Players", icon: Users },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/videos", label: "Videos", icon: Video },
];

function AdminDashboard() {
  const [playerCount, setPlayerCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);
  const [recapCount, setRecapCount] = useState(0);
  const [recentNews, setRecentNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    const fetchCounts = async () => {
      const playersColl = collection(db, "players");
      const newsColl = collection(db, "news");
      const recapsColl = collection(db, "recaps");
      
      const playersSnapshot = await getCountFromServer(query(playersColl, where("role", "==", "Player")));
      const newsSnapshot = await getCountFromServer(newsColl);
      const recapsSnapshot = await getCountFromServer(recapsColl);

      setPlayerCount(playersSnapshot.data().count);
      setNewsCount(newsSnapshot.data().count);
      setRecapCount(recapsSnapshot.data().count);
    };

    const newsQuery = query(collection(db, "news"), orderBy("date", "desc"), limit(3));
    const newsUnsubscribe = onSnapshot(newsQuery, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setRecentNews(newsData);
    });

    fetchCounts();
    return () => newsUnsubscribe();
  }, []);


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerCount}</div>
            <p className="text-xs text-muted-foreground">Total players on roster</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">News Articles</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newsCount}</div>
            <p className="text-xs text-muted-foreground">Total articles published</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Recaps</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recapCount}</div>
            <p className="text-xs text-muted-foreground">Total match recaps generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ready</div>
            <p className="text-xs text-muted-foreground">Use the chatbot for help</p>
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
            {recentNews.length > 0 ? (
                <ul className="space-y-4">
                {recentNews.map(article => (
                    <li key={article.id} className="flex items-start gap-4">
                        <div className="flex-1">
                        <h3 className="font-semibold line-clamp-1">{article.headline}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/news">Read</Link>
                        </Button>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No recent news.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UpcomingFixtureCard({ fixture, teamProfile }: { fixture: Fixture, teamProfile: TeamProfile }) {
    const fixtureDate = (fixture.date as any).toDate ? (fixture.date as any).toDate() : new Date(fixture.date);

    return (
        <Card className="w-full max-w-4xl mx-auto shadow-lg border-primary/20 border-2 bg-background/80 backdrop-blur-sm">
            <CardHeader className="text-center">
                 <p className="font-semibold text-primary">{fixture.competition}</p>
                <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(fixtureDate)}
                </p>
            </CardHeader>
             <CardContent className="flex items-center justify-center text-center">
                <div className="flex-1 flex items-center justify-end gap-4">
                    <h2 className="font-headline text-3xl hidden sm:block">{teamProfile.name}</h2>
                     <Avatar className="h-16 w-16">
                        <AvatarImage src={teamProfile.logoUrl} alt={teamProfile.name} data-ai-hint="team logo" />
                        <AvatarFallback>{teamProfile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </div>
                <div className="px-8">
                    <span className="text-4xl font-bold text-muted-foreground">vs</span>
                </div>
                <div className="flex-1 flex items-center justify-start gap-4">
                     <Avatar className="h-16 w-16">
                        <AvatarImage src={fixture.opponentLogoUrl} alt={fixture.opponent} data-ai-hint="team logo" />
                        <AvatarFallback>{fixture.opponent.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h2 className="font-headline text-3xl hidden sm:block">{fixture.opponent}</h2>
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <p className="text-sm text-muted-foreground">{fixture.venue}</p>
                 <Button asChild>
                    <Link href={`/fixtures/${fixture.id}`}>Match Center</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}


function PublicLandingPage() {
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
  const [featuredPlayers, setFeaturedPlayers] = useState<Player[]>([]);
  const [recentNews, setRecentNews] = useState<NewsArticle[]>([]);
  const [nextFixture, setNextFixture] = useState<Fixture | null>(null);

  useEffect(() => {
    getTeamProfile().then(setTeamProfile);

    const playersQuery = query(collection(db, "players"), where("role", "==", "Player"), orderBy("createdAt", "desc"), limit(3));
    const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
      setFeaturedPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    });

    const newsQuery = query(collection(db, "news"), orderBy("date", "desc"), limit(2));
    const newsUnsubscribe = onSnapshot(newsQuery, (snapshot) => {
      setRecentNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle)));
    });

    const fixtureQuery = query(collection(db, "fixtures"), where("status", "==", "UPCOMING"), orderBy("date", "asc"), limit(1));
    const fixtureUnsubscribe = onSnapshot(fixtureQuery, (snapshot) => {
        setNextFixture(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Fixture);
    });


    return () => {
      playersUnsubscribe();
      newsUnsubscribe();
      fixtureUnsubscribe();
    }
  }, []);

  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center pt-20 pb-32"
      >
        <Image 
          src="https://picsum.photos/seed/stadium/1920/1080" 
          alt="Capital City FC Stadium" 
          fill
          priority
          className="z-0 object-cover opacity-20" 
          data-ai-hint="stadium lights soccer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10"></div>
        <div className="relative z-20 text-center p-4 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 100 }}
          >
            <Image src={teamProfile?.logoUrl || '/icon.png'} alt="Team Logo" width={120} height={120} data-ai-hint="team logo" />
          </motion.div>
          <motion.h1 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.6, delay: 0.5 }}
             className="text-5xl md:text-8xl font-headline font-bold drop-shadow-lg mt-4"
          >
            {teamProfile?.name || 'Capital City FC'}
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-4 text-xl md:text-2xl font-light drop-shadow-md max-w-2xl"
          >
            Pride of the Capital. Your official source for news, fixtures, and all things Capital City.
          </motion.p>
          <motion.div
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.6, delay: 0.9 }}
             className="mt-10"
          >
            <Button asChild size="lg" className="text-lg py-7 px-8">
              <Link href="/club">Explore The Club</Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Upcoming Match Section */}
      {nextFixture && teamProfile && (
          <section className="relative z-20 -mt-24 pb-12">
               <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="container mx-auto px-4"
                >
                    <UpcomingFixtureCard fixture={nextFixture} teamProfile={teamProfile} />
                </motion.div>
          </section>
      )}
      
      {/* Recent News Section */}
      {recentNews.length > 0 && (
        <section className="py-24 bg-muted">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-headline font-bold text-center mb-12">Latest News</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {recentNews.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                >
                  <Link href="/news" className="block group">
                    <Card className="hover:shadow-xl transition-shadow h-full flex flex-col overflow-hidden">
                      {article.imageUrl && (
                          <div className="aspect-video relative overflow-hidden">
                            <Image src={article.imageUrl} alt={article.headline} fill className="object-cover group-hover:scale-105 transition-transform duration-300" data-ai-hint="news header" />
                          </div>
                      )}
                      <CardHeader>
                        <CardTitle className="font-headline text-2xl group-hover:text-primary transition-colors">{article.headline}</CardTitle>
                        <CardDescription>{new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-muted-foreground line-clamp-3">{article.content}</p>
                      </CardContent>
                      <CardFooter>
                        <span className="text-sm font-semibold text-primary">Read More &rarr;</span>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button asChild size="lg">
                  <Link href="/news">View All News</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Featured Players Section */}
      {featuredPlayers.length > 0 && (
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-headline font-bold text-center mb-12">Meet the Stars</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {featuredPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                >
                  <Link href={`/players/${player.id}`} className="block group">
                    <Card className="text-center overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 shadow-lg">
                      <div className="aspect-square relative">
                        <Image 
                          src={player.imageUrl} 
                          alt={player.name} 
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          data-ai-hint="player portrait"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-6 text-white text-left">
                          <Badge>#{player.jerseyNumber}</Badge>
                          <h3 className="font-headline text-3xl drop-shadow-md mt-1">{player.name}</h3>
                          <p className="text-lg opacity-90 drop-shadow-md">{player.position}</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button asChild variant="secondary" size="lg">
                <Link href="/players">View Full Roster</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-foreground text-background">
        <div className="container mx-auto px-4 py-12 text-center">
            <Image src={teamProfile?.logoUrl || '/icon.png'} alt="Team Logo" width={60} height={60} className="mx-auto" />
            <p className="font-headline text-2xl mt-4">{teamProfile?.name}</p>
            <div className="flex justify-center gap-4 my-6">
                {publicMenuItems.map(item => (
                    <Button key={item.href} asChild variant="link" className="text-background/80 hover:text-white">
                        <Link href={item.href}>{item.label}</Link>
                    </Button>
                ))}
            </div>
            <p className="text-sm text-background/60">&copy; {new Date().getFullYear()} {teamProfile?.name}. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  )
}


export default function HomePage() {
  const { user } = useAuth()

  if (user) {
    return <AdminDashboard />;
  }

  return <PublicLandingPage />;
}
