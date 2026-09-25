
"use client"

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addFormation, deleteFormation } from "@/lib/formations";
import type { Player, Formation } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

import { DndContext, DragEndEvent } from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, ChevronDown, Save, UserPlus, Shirt, Search, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DroppablePlayerSlot } from "./player-slot";
import { PlayerDraggableCard } from "./player-draggable-card";
import { cn } from "@/lib/utils";

const formationSchema = z.object({
  name: z.string().min(3, "Formation name is required."),
  notes: z.string().optional(),
});
type FormationFormData = z.infer<typeof formationSchema>;

const positionCoordinates: { [key: string]: { [key: string]: string } } = {
  "4-4-2": {
    "GK": "top-[90%] left-1/2",
    "DEF-1": "top-[75%] left-[15%]", "DEF-2": "top-[78%] left-[35%]", "DEF-3": "top-[78%] left-[65%]", "DEF-4": "top-[75%] left-[85%]",
    "MID-1": "top-[50%] left-[18%]", "MID-2": "top-[55%] left-[40%]", "MID-3": "top-[55%] left-[60%]", "MID-4": "top-[50%] left-[82%]",
    "FWD-1": "top-[25%] left-[35%]", "FWD-2": "top-[25%] left-[65%]",
  },
  "4-3-3": {
    "GK": "top-[90%] left-1/2",
    "DEF-1": "top-[75%] left-[15%]", "DEF-2": "top-[78%] left-[35%]", "DEF-3": "top-[78%] left-[65%]", "DEF-4": "top-[75%] left-[85%]",
    "MID-1": "top-[55%] left-[25%]", "MID-2": "top-[60%] left-[50%]", "MID-3": "top-[55%] left-[75%]",
    "FWD-1": "top-[25%] left-[20%]", "FWD-2": "top-[18%] left-[50%]", "FWD-3": "top-[25%] left-[80%]",
  }
};

const formationSlots = {
    "4-4-2": [
        { id: "starter-0", position: positionCoordinates["4-4-2"]["GK"]},
        { id: "starter-1", position: positionCoordinates["4-4-2"]["DEF-1"]},
        { id: "starter-2", position: positionCoordinates["4-4-2"]["DEF-2"]},
        { id: "starter-3", position: positionCoordinates["4-4-2"]["DEF-3"]},
        { id: "starter-4", position: positionCoordinates["4-4-2"]["DEF-4"]},
        { id: "starter-5", position: positionCoordinates["4-4-2"]["MID-1"]},
        { id: "starter-6", position: positionCoordinates["4-4-2"]["MID-2"]},
        { id: "starter-7", position: positionCoordinates["4-4-2"]["MID-3"]},
        { id: "starter-8", position: positionCoordinates["4-4-2"]["MID-4"]},
        { id: "starter-9", position: positionCoordinates["4-4-2"]["FWD-1"]},
        { id: "starter-10", position: positionCoordinates["4-4-2"]["FWD-2"]},
    ],
    "4-3-3": [
        { id: "starter-0", position: positionCoordinates["4-3-3"]["GK"]},
        { id: "starter-1", position: positionCoordinates["4-3-3"]["DEF-1"]},
        { id: "starter-2", position: positionCoordinates["4-3-3"]["DEF-2"]},
        { id: "starter-3", position: positionCoordinates["4-3-3"]["DEF-3"]},
        { id: "starter-4", position: positionCoordinates["4-3-3"]["DEF-4"]},
        { id: "starter-5", position: positionCoordinates["4-3-3"]["MID-1"]},
        { id: "starter-6", position: positionCoordinates["4-3-3"]["MID-2"]},
        { id: "starter-7", position: positionCoordinates["4-3-3"]["MID-3"]},
        { id: "starter-8", position: positionCoordinates["4-3-3"]["FWD-1"]},
        { id: "starter-9", position: positionCoordinates["4-3-3"]["FWD-2"]},
        { id: "starter-10", position: positionCoordinates["4-3-3"]["FWD-3"]},
    ]
}


export function FormationManager() {
  const { toast } = useToast();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tacticalNotes, setTacticalNotes] = useState("");
  const [currentFormation, setCurrentFormation] = useState<"4-4-2" | "4-3-3">("4-4-2");
  
  const [startingXI, setStartingXI] = useState<(Player | null)[]>(Array(11).fill(null));
  const [substitutes, setSubstitutes] = useState<(Player | null)[]>(Array(7).fill(null));
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormationFormData>({
    resolver: zodResolver(formationSchema),
  });

  useEffect(() => {
    setIsLoading(true);
    const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
    const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setAllPlayers(playersData.filter(p => p.status === 'Active'));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching players:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch players." });
      setIsLoading(false);
    });

    const formationsQuery = query(collection(db, "formations"), orderBy("createdAt", "desc"));
    const formationsUnsubscribe = onSnapshot(formationsQuery, (snapshot) => {
      setFormations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formation)));
    });

    return () => {
      playersUnsubscribe();
      formationsUnsubscribe();
    };
  }, [toast]);

  const handleDragStart = () => setIsDragging(true);
  
  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;

    if (over && active) {
      const draggedPlayerId = active.id as string;
      const slotId = over.id as string;

      const playerToAssign = allPlayers.find(p => p.id === draggedPlayerId);
      if (!playerToAssign) return;

      const isStarterSlot = slotId.startsWith("starter-");
      const index = parseInt(slotId.split('-')[1]);

      const isAlreadyAssigned = startingXI.some(p => p?.id === draggedPlayerId) || substitutes.some(p => p?.id === draggedPlayerId);

      if (isAlreadyAssigned) {
        toast({ title: "Player already assigned", description: "This player is already in the lineup.", variant: "destructive" });
        return;
      }
      
      if (isStarterSlot) {
        const newStarters = [...startingXI];
        newStarters[index] = playerToAssign;
        setStartingXI(newStarters);
      } else {
        const newSubs = [...substitutes];
        newSubs[index] = playerToAssign;
        setSubstitutes(newSubs);
      }
    }
  };

  const handleUnassignPlayer = (player: Player) => {
    setStartingXI(prev => prev.map(p => (p?.id === player.id ? null : p)));
    setSubstitutes(prev => prev.map(p => (p?.id === player.id ? null : p)));
  }

  const handleLoadFormation = (formation: Formation) => {
    setStartingXI(formation.startingXI.concat(Array(11 - formation.startingXI.length).fill(null)));
    setSubstitutes(formation.substitutes.concat(Array(7 - formation.substitutes.length).fill(null)));
    setValue("name", formation.name);
    setTacticalNotes(formation.notes || "");
    toast({ title: "Formation Loaded", description: `${formation.name} is ready for editing.` });
  }

  const setPresetFormation = (preset: '4-4-2' | '4-3-3') => {
    setCurrentFormation(preset);
    let available = [...allPlayers];
    const newStarters: (Player | null)[] = Array(11).fill(null);
    const newSubs: (Player | null)[] = Array(7).fill(null);

    const assign = (position: Player['position'], count: number): Player[] => {
      const assigned: Player[] = [];
      for (let i = 0; i < count; i++) {
        const playerIndex = available.findIndex(p => p.position === position);
        if (playerIndex !== -1) {
          assigned.push(available[playerIndex]);
          available.splice(playerIndex, 1);
        }
      }
      return assigned;
    }
    
    let gk = assign('Goalkeeper', 1);
    let defs, mids, fwds;

    if (preset === '4-4-2') {
      defs = assign("Defender", 4);
      mids = assign("Midfielder", 4);
      fwds = assign("Forward", 2);
    } else { // 4-3-3
      defs = assign("Defender", 4);
      mids = assign("Midfielder", 3);
      fwds = assign("Forward", 3);
    }
    
    // Fill with best-fit players first
    let startersDraft = [...gk, ...defs, ...mids, ...fwds];
    // Fill any gaps with remaining players
    while(startersDraft.length < 11 && available.length > 0) {
        startersDraft.push(available.shift()!);
    }
    
    setStartingXI(startersDraft.concat(Array(11-startersDraft.length).fill(null)));
    setSubstitutes(newSubs.map(() => available.shift() || null));
    toast({ title: `Loaded ${preset} preset` });
  };

  const onSubmit = async (data: FormationFormData) => {
    const finalStarters = startingXI.filter(p => p !== null) as Player[];
    const finalSubstitutes = substitutes.filter(p => p !== null) as Player[];

    if (finalStarters.length !== 11) {
      toast({ variant: "destructive", title: "Invalid Lineup", description: "Starting XI must have exactly 11 players." });
      return;
    }
    setIsSubmitting(true);
    try {
      await addFormation(data.name, finalStarters, finalSubstitutes, tacticalNotes);
      toast({ title: "Success!", description: "Formation saved successfully." });
      reset();
      setStartingXI(Array(11).fill(null));
      setSubstitutes(Array(7).fill(null));
      setTacticalNotes("");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save formation." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (formationId: string) => {
    try {
      await deleteFormation(formationId);
      toast({ title: "Success", description: "Formation deleted." });
    } catch (error) {
      console.error("Error deleting formation:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete formation." });
    }
  };

  const assignedPlayerIds = new Set([...startingXI.map(p => p?.id), ...substitutes.map(p => p?.id)].filter(Boolean));
  const availablePlayers = allPlayers
    .filter(p => !assignedPlayerIds.has(p.id))
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Create New Formation</CardTitle>
            <CardDescription>Drag and drop players to build your team lineup and tactical plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-grow">
                  <Label htmlFor="name">Formation Name</Label>
                  <Input id="name" {...register("name")} placeholder="e.g. 4-4-2 Attacking" className="max-w-sm" />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div className="space-x-2">
                  <Button type="button" variant={currentFormation === '4-4-2' ? 'default' : 'outline'} onClick={() => setPresetFormation('4-4-2')}>4-4-2</Button>
                  <Button type="button" variant={currentFormation === '4-3-3' ? 'default' : 'outline'} onClick={() => setPresetFormation('4-3-3')}>4-3-3</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pitch and Bench */}
                <div className="lg:col-span-2">
                  <div className="aspect-[3/4] md:aspect-video bg-green-900/40 p-2 sm:p-4 rounded-lg relative overflow-hidden border-2 border-green-600/30">
                    <Image src="/pitch-vertical.svg" alt="Pitch" layout="fill" objectFit="cover" className="opacity-20" />
                    <div className="relative z-10 h-full w-full">
                      <h3 className="text-center font-bold text-white mb-2 sm:mb-4">Starting XI ({startingXI.filter(p => p).length}/11)</h3>
                      {formationSlots[currentFormation].map((slot, i) => (
                          <div key={slot.id} className={cn("absolute -translate-x-1/2 -translate-y-1/2", slot.position)}>
                             <DroppablePlayerSlot id={slot.id} player={startingXI[i]} onRemove={handleUnassignPlayer} showPulse={isDragging} />
                          </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 p-2 sm:p-4 rounded-lg bg-muted">
                    <h3 className="font-bold text-lg mb-2">Bench ({substitutes.filter(p => p).length}/7)</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1 sm:gap-2">
                      {substitutes.map((player, i) => (
                        <DroppablePlayerSlot key={`sub-${i}`} id={`sub-${i}`} player={player} isSubstitute showPulse={isDragging} onRemove={handleUnassignPlayer} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Player Roster */}
                <div className="lg:col-span-1">
                  <Card className="flex flex-col h-full">
                    <CardHeader className="p-4 border-b sticky top-0 bg-card z-10">
                      <CardTitle className="text-lg">Available Players</CardTitle>
                      <CardDescription>Drag a player to an empty slot on the pitch or bench.</CardDescription>
                      <div className="relative pt-2">
                        <Search className="absolute left-2.5 top-4 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search players..."
                          className="pl-9"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <ScrollArea className="h-[400px] lg:h-[520px]">
                        {isLoading ? <Loader2 className="mx-auto my-8 animate-spin" /> :
                          <div className="p-2 space-y-1">
                            {availablePlayers.length > 0 ? availablePlayers.map(p => (
                              <PlayerDraggableCard key={p.id} player={p} />
                            )) : (
                              <p className="p-4 text-center text-sm text-muted-foreground">No available players found.</p>
                            )}
                          </div>
                        }
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Tactical Notes */}
              <div>
                <Label htmlFor="notes">Tactical Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="e.g. 'Use high press on the wings...', 'Set piece: Corner kick to the far post...'" 
                  value={tacticalNotes}
                  onChange={(e) => setTacticalNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Formation
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Saved Formations</CardTitle>
            <CardDescription>Your previously saved team lineups. Click to expand or load into the editor.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="animate-spin" /> : formations.length > 0 ? (
              <div className="space-y-2">
                {formations.map(formation => (
                  <Collapsible key={formation.id} className="border rounded-lg transition-all hover:bg-muted/50">
                    <div className="flex items-center justify-between p-2 group">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 flex-1 cursor-pointer p-2">
                          <Shirt className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-lg">{formation.name}</h4>
                          <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:-rotate-180" />
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleLoadFormation(formation)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {formation.name}?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(formation.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CollapsibleContent className="space-y-4 pt-2 p-4 border-t">
                      {formation.notes && (
                        <div>
                          <h5 className="font-medium mb-2 pl-2">Tactical Notes</h5>
                          <p className="p-3 text-sm text-muted-foreground border rounded-md bg-background">{formation.notes}</p>
                        </div>
                      )}
                      <div>
                        <h5 className="font-medium mb-2 pl-2">Starting XI</h5>
                        <div className="flex flex-wrap gap-2">
                          {formation.startingXI.map(p => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium mb-2 pl-2">Substitutes</h5>
                        <div className="flex flex-wrap gap-2">
                          {formation.substitutes.map(p => <Badge key={p.id} variant="outline">{p.name}</Badge>)}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-8 text-muted-foreground">No formations saved yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DndContext>
  );
}
