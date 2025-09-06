
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { BarChart, FileText, Newspaper, Users, Calendar } from "lucide-react"
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
        <Card className="w-full max-w-4xl mx-auto shadow-lg -mt-20 relative z-20 border-primary/20 border-2">
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
    // Fetch Team Profile
    getTeamProfile().then(setTeamProfile);

    // Fetch a few players to feature
    const playersQuery = query(collection(db, "players"), where("role", "==", "Player"), orderBy("createdAt", "desc"), limit(3));
    const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setFeaturedPlayers(playersData);
    });

    // Fetch recent news
    const newsQuery = query(collection(db, "news"), orderBy("date", "desc"), limit(2));
    const newsUnsubscribe = onSnapshot(newsQuery, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setRecentNews(newsData);
    });

    // Fetch next fixture
    const fixtureQuery = query(collection(db, "fixtures"), where("status", "==", "UPCOMING"), orderBy("date", "asc"), limit(1));
    const fixtureUnsubscribe = onSnapshot(fixtureQuery, (snapshot) => {
        if (!snapshot.empty) {
            setNextFixture({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Fixture);
        } else {
            setNextFixture(null);
        }
    });


    return () => {
      playersUnsubscribe();
      newsUnsubscribe();
      fixtureUnsubscribe();
    }
  }, []);

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative h-[60vh] bg-gray-800 text-white flex items-center justify-center">
        <Image 
          src="https://picsum.photos/1600/900" 
          alt="Capital City FC Stadium" 
          fill
          objectFit="cover" 
          className="z-0 opacity-30" 
          data-ai-hint="stadium lights soccer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-0"></div>
        <div className="relative z-10 text-center p-4">
          <h1 className="text-5xl md:text-7xl font-headline font-bold drop-shadow-lg">{teamProfile?.name || 'Capital City FC'}</h1>
          <p className="mt-4 text-xl md:text-2xl font-light drop-shadow-md">Pride of the Capital</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/club">The Club</Link>
          </Button>
        </div>
      </section>

      {/* Upcoming Fixture Section */}
      {nextFixture && teamProfile && (
        <section className="py-12 bg-background">
           <UpcomingFixtureCard fixture={nextFixture} teamProfile={teamProfile} />
        </section>
      )}
      
      {/* Recent News Section */}
      {recentNews.length > 0 && (
        <section className="py-12 lg:py-24 bg-muted">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-headline font-bold text-center mb-8">Latest News</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {recentNews.map(article => (
                <Link key={article.id} href="/news" className="block group">
                  <Card className="hover:shadow-xl transition-shadow h-full flex flex-col">
                    {article.imageUrl && (
                        <div className="aspect-video relative overflow-hidden rounded-t-lg">
                           <Image src={article.imageUrl} alt={article.headline} fill objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="news header" />
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
              ))}
            </div>
            <div className="text-center mt-12">
              <Button asChild>
                  <Link href="/news">View All News</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Featured Players Section */}
      {featuredPlayers.length > 0 && (
        <section className="py-12 lg:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-headline font-bold text-center mb-8">Meet the Stars</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {featuredPlayers.map(player => (
                <Link href={`/players/${player.id}`} key={player.id} className="block group">
                  <Card className="text-center overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
                    <div className="aspect-square relative">
                      <Image 
                        src={player.imageUrl} 
                        alt={player.name} 
                        fill
                        objectFit="cover" 
                        data-ai-hint="player portrait"
                        className="group-hover:scale-105 transition-transform duration-300"
                      />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                       <div className="absolute bottom-0 left-0 p-4 text-white">
                         <h3 className="font-headline text-2xl drop-shadow-md">{player.name}</h3>
                         <p className="text-lg opacity-90 drop-shadow-md">{player.position}</p>
                       </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="text-center mt-12">
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

/**
 * The main page component that decides whether to show the
 * admin dashboard or the public-facing landing page based on
 * the user's authentication status.
 */
export default function HomePage() {
  const { user } = useAuth()

  // If a user object exists, they are logged in as an admin.
  if (user) {
    return <AdminDashboard />;
  }

  // Otherwise, show the public landing page.
  return <PublicLandingPage />;
}
