
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { deletePlayer } from "@/lib/players"
import type { Player } from "@/lib/data"
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
import { Button } from "@/components/ui/button"
import { Search, PlusCircle, Trash2, Edit, Loader2, UserX } from "lucide-react"
import { PlayerForm } from "./_components/player-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"


export default function PlayersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const q = query(collection(db, "players"), orderBy("jerseyNumber", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(playersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching players:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch players."})
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleEdit = (player: Player) => {
    setSelectedPlayer(player)
    setIsFormOpen(true)
  }

  const handleAddNew = () => {
    setSelectedPlayer(null)
    setIsFormOpen(true)
  }

  const handleDelete = async (player: Player) => {
    try {
      await deletePlayer(player);
      toast({ title: "Success", description: "Player deleted successfully."})
    } catch (error) {
       console.error("Error deleting player:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to delete player."})
    }
  }

  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PlayerForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        player={selectedPlayer}
      />
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Club Roster</h1>
            <p className="text-muted-foreground mt-2">Browse the talented players of Capital City FC.</p>
          </div>
          {user && (
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2" />
              Add New Player
            </Button>
          )}
        </div>
        <div className="mt-6 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search player..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-16 rounded-lg bg-muted">
            <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Players Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try a different search term." : "There are no players in the roster yet."}
            </p>
            {user && !searchQuery && (
                 <Button onClick={handleAddNew} className="mt-6">
                    <PlusCircle className="mr-2" />
                    Add First Player
                </Button>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="h-full flex flex-col group/player relative">
              <Link href={`/players/${player.id}`} className="flex flex-col h-full grow">
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
                      #{player.jerseyNumber}
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
              </Link>
              {user && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/player:opacity-100 transition-opacity">
                  <Button size="icon" variant="outline" className="h-8 w-8 bg-background/80" onClick={() => handleEdit(player)}>
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                  </Button>
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button size="icon" variant="destructive" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                             <span className="sr-only">Delete</span>
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the player profile and their image.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(player)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
