
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, ChevronDown, Save, UserPlus, Shirt } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PlayerSlot } from "./player-slot";
import { cn } from "@/lib/utils";

const formationSchema = z.object({
    name: z.string().min(3, "Formation name is required."),
});
type FormationFormData = z.infer<typeof formationSchema>;

export function FormationManager() {
    const { toast } = useToast();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [formations, setFormations] = useState<Formation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [startingXI, setStartingXI] = useState<(Player | null)[]>(Array(11).fill(null));
    const [substitutes, setSubstitutes] = useState<(Player | null)[]>(Array(7).fill(null));

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormationFormData>({
        resolver: zodResolver(formationSchema),
    });

    useEffect(() => {
        setIsLoading(true);
        const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
        const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            setAllPlayers(playersData.filter(p => p.status === 'Active'));
        });

        const formationsQuery = query(collection(db, "formations"), orderBy("createdAt", "desc"));
        const formationsUnsubscribe = onSnapshot(formationsQuery, (snapshot) => {
            setFormations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formation)));
            setIsLoading(false);
        });

        return () => {
            playersUnsubscribe();
            formationsUnsubscribe();
        };
    }, []);

    const handlePlayerSelect = (player: Player) => {
        setSelectedPlayer(player.id === selectedPlayer?.id ? null : player);
    }
    
    const handleAssignPlayer = (index: number, type: 'starter' | 'sub') => {
        if (!selectedPlayer) return;

        // Prevent assigning the same player twice
        if (startingXI.some(p => p?.id === selectedPlayer.id) || substitutes.some(p => p?.id === selectedPlayer.id)) {
            toast({ variant: 'destructive', title: "Player already assigned" });
            return;
        }

        if (type === 'starter') {
            const newStarters = [...startingXI];
            newStarters[index] = selectedPlayer;
            setStartingXI(newStarters);
        } else {
            const newSubs = [...substitutes];
            newSubs[index] = selectedPlayer;
            setSubstitutes(newSubs);
        }
        setSelectedPlayer(null);
    };

    const handleUnassignPlayer = (player: Player) => {
        setStartingXI(prev => prev.map(p => (p?.id === player.id ? null : p)));
        setSubstitutes(prev => prev.map(p => (p?.id === player.id ? null : p)));
    }
    
    const setPresetFormation = (preset: '4-4-2' | '4-3-3') => {
        let playersToAssign = [...allPlayers];
        const newStarters = Array(11).fill(null);
        
        const assign = (position: Player['position']) => {
            const playerIndex = playersToAssign.findIndex(p => p.position === position);
            if (playerIndex !== -1) {
                const player = playersToAssign[playerIndex];
                playersToAssign.splice(playerIndex, 1);
                return player;
            }
            // Fallback to any player if specific position is not found
            return playersToAssign.shift() || null;
        }

        if (preset === '4-4-2') {
            newStarters[0] = assign("Goalkeeper");
            newStarters[1] = assign("Defender");
            newStarters[2] = assign("Defender");
            newStarters[3] = assign("Defender");
            newStarters[4] = assign("Defender");
            newStarters[5] = assign("Midfielder");
            newStarters[6] = assign("Midfielder");
            newStarters[7] = assign("Midfielder");
            newStarters[8] = assign("Midfielder");
            newStarters[9] = assign("Forward");
            newStarters[10] = assign("Forward");
        } else if (preset === '4-3-3') {
            newStarters[0] = assign("Goalkeeper");
            newStarters[1] = assign("Defender");
            newStarters[2] = assign("Defender");
            newStarters[3] = assign("Defender");
            newStarters[4] = assign("Defender");
            newStarters[5] = assign("Midfielder");
            newStarters[6] = assign("Midfielder");
            newStarters[7] = assign("Midfielder");
            newStarters[8] = assign("Forward");
            newStarters[9] = assign("Forward");
            newStarters[10] = assign("Forward");
        }
        setStartingXI(newStarters);
        setSubstitutes(Array(7).fill(null).map(() => playersToAssign.shift() || null));
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
            await addFormation(data.name, finalStarters, finalSubstitutes);
            toast({ title: "Success!", description: "Formation saved successfully." });
            reset();
            setStartingXI(Array(11).fill(null));
            setSubstitutes(Array(7).fill(null));
            setSelectedPlayer(null);
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
    
    const assignedPlayerIds = new Set([...startingXI.map(p => p?.id), ...substitutes.map(p => p?.id)]);
    const availablePlayers = allPlayers.filter(p => !assignedPlayerIds.has(p.id));

    return (
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Create New Formation</CardTitle>
                    <CardDescription>Name your formation, select players, and assign them to the pitch or bench.</CardDescription>
                </CardHeader>
                <CardContent>
                     <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-grow">
                                <Label htmlFor="name">Formation Name</Label>
                                <Input id="name" {...register("name")} placeholder="e.g. 4-4-2 Attacking" className="max-w-sm"/>
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                            <div className="space-x-2">
                                <Button type="button" variant="outline" onClick={() => setPresetFormation('4-4-2')}>4-4-2</Button>
                                <Button type="button" variant="outline" onClick={() => setPresetFormation('4-3-3')}>4-3-3</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           {/* Pitch and Bench */}
                            <div className="lg:col-span-2">
                                <div className="aspect-[4/3] bg-green-800/20 border-2 border-dashed border-green-300/20 p-2 sm:p-4 rounded-lg relative overflow-hidden">
                                     <Image src="/pitch-lines.svg" alt="Pitch" layout="fill" objectFit="contain" className="opacity-20" />
                                    {/* Starters */}
                                    <div className="relative z-10 h-full">
                                        <h3 className="text-center font-bold text-white mb-2 sm:mb-4">Starting XI ({startingXI.filter(p=>p).length}/11)</h3>
                                        <div className="grid grid-cols-5 grid-rows-4 h-[calc(100%-40px)] gap-1 sm:gap-2">
                                            {startingXI.map((player, i) => (
                                                <PlayerSlot key={`starter-${i}`} player={player} onRemove={handleUnassignPlayer} onAssign={() => handleAssignPlayer(i, 'starter')} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-2 sm:p-4 rounded-lg bg-muted">
                                     <h3 className="font-bold text-lg mb-2">Bench ({substitutes.filter(p=>p).length})</h3>
                                     <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1 sm:gap-2">
                                        {substitutes.map((player, i) => (
                                             <PlayerSlot key={`sub-${i}`} player={player} isSubstitute onRemove={handleUnassignPlayer} onAssign={() => handleAssignPlayer(i, 'sub')} />
                                        ))}
                                     </div>
                                </div>
                            </div>

                            {/* Player Roster */}
                            <div className="lg:col-span-1">
                                <Card>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-lg">Available Players</CardTitle>
                                        <CardDescription>Click a player to select them</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[400px] lg:h-[480px]">
                                            <div className="p-2 space-y-1">
                                                {availablePlayers.length > 0 ? availablePlayers.map(p => (
                                                    <div 
                                                        key={p.id}
                                                        onClick={() => handlePlayerSelect(p)}
                                                        className={cn(
                                                            "p-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors",
                                                            selectedPlayer?.id === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                                        )}
                                                    >
                                                        <Image src={p.imageUrl} alt={p.name} width={40} height={40} className="rounded-full w-10 h-10 object-cover" />
                                                        <div>
                                                            <p className="font-semibold text-sm">{p.name}</p>
                                                            <p className="text-xs opacity-80">{p.position}</p>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <p className="p-4 text-center text-sm text-muted-foreground">No available players.</p>
                                                )}
                                            </div>
                                        </ScrollArea>
                                        {selectedPlayer && (
                                            <div className="p-4 border-t space-y-2">
                                                <p className="font-semibold text-center">Assign {selectedPlayer.name} to an empty slot on the pitch or bench.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
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
                    <CardDescription>Your previously saved team lineups for quick use in fixtures.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Loader2 className="animate-spin" /> : formations.length > 0 ? (
                        <div className="space-y-2">
                            {formations.map(formation => (
                                <Collapsible key={formation.id} className="border rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center gap-3 flex-1 cursor-pointer p-2">
                                                <h4 className="font-semibold text-lg">{formation.name}</h4>
                                                <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:-rotate-180" />
                                            </div>
                                        </CollapsibleTrigger>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
                                    <CollapsibleContent className="space-y-4 pt-4">
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
    );
}

    