import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BarChart2, Clapperboard, Medal, User } from "lucide-react"

import { getPlayerById, getVideosByPlayerId } from "@/lib/data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PlayerProfilePage({ params }: { params: { id: string } }) {
  const player = getPlayerById(params.id)
  if (!player) {
    notFound()
  }

  const playerVideos = getVideosByPlayerId(params.id)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row gap-6 p-6">
          <Avatar className="h-32 w-32 border-4 border-primary/20">
            <AvatarImage src={player.imageUrl} alt={player.name} data-ai-hint="player portrait" />
            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-headline font-bold">{player.name}</h1>
              <Badge variant="secondary" className="text-lg">#{player.number}</Badge>
            </div>
            <p className="text-xl text-primary font-semibold mt-1">{player.position}</p>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bio">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid md:grid-cols-3">
              <TabsTrigger value="bio"><User className="mr-2" />Bio</TabsTrigger>
              <TabsTrigger value="stats"><BarChart2 className="mr-2" />Stats</TabsTrigger>
              <TabsTrigger value="videos"><Clapperboard className="mr-2" />Videos</TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="bio" className="prose prose-sm max-w-none text-foreground">
              <p>{player.bio}</p>
              <h3 className="font-headline text-lg font-semibold mt-6 mb-2 flex items-center gap-2"><Medal className="text-accent" />Career Highlights</h3>
              <ul className="list-disc pl-5 space-y-1">
                {player.careerHighlights.map((highlight, index) => (
                  <li key={index}>{highlight}</li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="stats">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Appearances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.appearances}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Goals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.goals}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">Assists</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">{player.stats.assists}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="videos">
              {playerVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playerVideos.map((video) => (
                     <Link href="/videos" key={video.id}>
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="relative aspect-video">
                           <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover" data-ai-hint="soccer action" />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm">{video.duration}</div>
                        </div>
                        <CardHeader className="p-3">
                          <CardTitle className="text-base font-semibold truncate">{video.title}</CardTitle>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No videos available for this player.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
