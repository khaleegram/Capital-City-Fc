import Link from "next/link"
import Image from "next/image"

import { players } from "@/lib/data"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export default function PlayersPage() {
  // In a real app, search would be stateful and filter the list
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-headline font-bold">Club Roster</h1>
        <p className="text-muted-foreground mt-2">Browse through the talented players of Capital City FC.</p>
        <div className="mt-4 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search player..." className="pl-10" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {players.map((player) => (
          <Link href={`/players/${player.id}`} key={player.id}>
            <Card className="h-full flex flex-col hover:shadow-lg hover:border-primary/50 transition-all duration-300">
              <CardHeader className="p-0">
                <div className="relative aspect-square">
                  <Image
                    src={player.imageUrl}
                    alt={player.name}
                    fill
                    className="object-cover rounded-t-lg"
                    data-ai-hint="player portrait"
                  />
                  <Badge className="absolute top-3 right-3 bg-primary/80 backdrop-blur-sm">
                    #{player.number}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1">
                <CardTitle className="font-headline text-xl">{player.name}</CardTitle>
                <CardDescription>{player.position}</CardDescription>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                 <Badge variant="outline">{player.stats.appearances} Appearances</Badge>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
