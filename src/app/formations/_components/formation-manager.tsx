
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
import { Loader2, Trash2, ChevronDown, Save, UserPlus, Shirt, UserMinus } from "lucide-react";
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
    const [startingXI, setStartingXI] = useState<Player[]>([]);
    const [substitutes, setSubstitutes] = useState<Player[]>([]);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormationFormData>({
        resolver: zodResolver(formationSchema),
    });

    useEffect(() => {
        const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
        const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            setAllPlayers(playersData.filter(p => p.status === 'Active' || p.status === 'On Loan'));
        });

        const formationsQuery = query(collection(db, "formations"), orderBy("createdAt", "desc"));
        const formationsUnsubscribe = onSnapshot(formationsQuery, (snapshot) => {
            const formationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formation));
            setFormations(formationsData);
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

    const handleAssignPlayer = (role: 'starter' | 'sub') => {
        if (!selectedPlayer) return;

        // Remove from other list if present
        const newStarters = startingXI.filter(p => p.id !== selectedPlayer.id);
        const newSubs = substitutes.filter(p => p.id !== selectedPlayer.id);

        if (role === 'starter' && newStarters.length < 11) {
            setStartingXI([...newStarters, selectedPlayer]);
        } else if (role === 'starter') {
            toast({ variant: 'destructive', title: "Starting XI is full" });
        }

        if (role === 'sub') {
            setSubstitutes([...newSubs, selectedPlayer]);
        }

        setSelectedPlayer(null);
    }
    
    const handleUnassignPlayer = (player: Player) => {
        setStartingXI(prev => prev.filter(p => p.id !== player.id));
        setSubstitutes(prev => prev.filter(p => p.id !== player.id));
    }


    const onSubmit = async (data: FormationFormData) => {
        if (startingXI.length !== 11) {
            toast({ variant: "destructive", title: "Invalid Lineup", description: "Starting XI must have exactly 11 players." });
            return;
        }
        setIsSubmitting(true);
        try {
            await addFormation(data.name, startingXI, substitutes);
            toast({ title: "Success!", description: "Formation saved successfully." });
            reset();
            setStartingXI([]);
            setSubstitutes([]);
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
    
    const assignedPlayerIds = new Set([...startingXI.map(p => p.id), ...substitutes.map(p => p.id)]);
    const availablePlayers = allPlayers.filter(p => !assignedPlayerIds.has(p.id));

    return (
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Create New Formation</CardTitle>
                    <CardDescription>Name your formation, then select players from the roster to assign them to the starting XI or the bench.</CardDescription>
                </CardHeader>
                <CardContent>
                     <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div>
                            <Label htmlFor="name">Formation Name</Label>
                            <Input id="name" {...register("name")} placeholder="e.g. 4-4-2 Attacking" className="max-w-sm"/>
                            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                           {/* Pitch and Bench */}
                            <div className="lg:col-span-2">
                                <div className="aspect-[4/3] bg-green-800/20 border-2 border-dashed border-green-300/20 p-2 sm:p-4 rounded-lg relative overflow-hidden">
                                     <Image src="/pitch-lines.svg" alt="Pitch" layout="fill" objectFit="contain" className="opacity-20" />
                                    {/* Starters */}
                                    <div className="relative z-10 h-full">
                                        <h3 className="text-center font-bold text-white mb-2 sm:mb-4">Starting XI ({startingXI.length}/11)</h3>
                                        <div className="grid grid-cols-5 grid-rows-4 h-[calc(100%-40px)] gap-1 sm:gap-2">
                                            {Array.from({ length: 11 }).map((_, i) => (
                                                <PlayerSlot key={`starter-${i}`} player={startingXI[i]} onRemove={handleUnassignPlayer} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-2 sm:p-4 rounded-lg bg-muted">
                                     <h3 className="font-bold text-lg mb-2">Bench ({substitutes.length})</h3>
                                     <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1 sm:gap-2">
                                        {Array.from({ length: 7 }).map((_, i) => (
                                             <PlayerSlot key={`sub-${i}`} player={substitutes[i]} isSubstitute onRemove={handleUnassignPlayer} />
                                        ))}
                                     </div>
                                </div>
                            </div>

                            {/* Player Roster */}
                            <div className="lg:col-span-1">
                                <Card>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-lg">Roster</CardTitle>
                                        <CardDescription>Select a player to assign</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[400px] lg:h-[480px]">
                                            <div className="p-2 space-y-1">
                                                {availablePlayers.map(p => (
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
                                                ))}
                                            </div>
                                        </ScrollArea>
                                        {selectedPlayer && (
                                            <div className="p-4 border-t space-y-2">
                                                <p className="font-semibold text-center">Assign {selectedPlayer.name}</p>
                                                <div className="flex gap-2">
                                                <Button className="w-full" size="sm" onClick={() => handleAssignPlayer('starter')}><UserPlus className="mr-2"/> Starter</Button>
                                                <Button className="w-full" size="sm" variant="secondary" onClick={() => handleAssignPlayer('sub')}><Shirt className="mr-2"/> Sub</Button>
                                                </div>
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
