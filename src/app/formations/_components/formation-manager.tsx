
"use client"

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addFormation, deleteFormation } from "@/lib/formations";
import type { Player, Formation } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlusCircle, Trash2, Users, ChevronDown, ChevronUp, Save } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const formationSchema = z.object({
    name: z.string().min(3, "Formation name is required."),
});
type FormationFormData = z.infer<typeof formationSchema>;

const PlayerPicker = ({ title, players, selectedPlayers, onSelectPlayer }: { title: string, players: Player[], selectedPlayers: Player[], onSelectPlayer: (player: Player) => void }) => {
    const availablePlayers = players.filter(p => !selectedPlayers.some(sp => sp.id === p.id));

    return (
        <Card>
            <CardHeader className="p-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5"/> {title} ({selectedPlayers.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-60">
                    <div className="p-4 space-y-2">
                        {selectedPlayers.length > 0 ? selectedPlayers.map(player => (
                            <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={player.imageUrl} alt={player.name} />
                                        <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{player.name}</span>
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onSelectPlayer(player)}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        )) : <p className="text-sm text-muted-foreground text-center py-4">No players selected.</p>}
                    </div>
                </ScrollArea>
                <Separator />
                 <ScrollArea className="h-60">
                    <p className="text-sm font-medium p-4">Available Players</p>
                    <div className="p-4 pt-0 space-y-2">
                    {availablePlayers.map(player => (
                        <div key={player.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => onSelectPlayer(player)}>
                             <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={player.imageUrl} alt={player.name} />
                                    <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">{player.name}</p>
                                    <p className="text-xs text-muted-foreground">{player.position}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


export function FormationManager() {
    const { toast } = useToast();
    const [players, setPlayers] = useState<Player[]>([]);
    const [formations, setFormations] = useState<Formation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [startingXI, setStartingXI] = useState<Player[]>([]);
    const [substitutes, setSubstitutes] = useState<Player[]>([]);
    
    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormationFormData>({
        resolver: zodResolver(formationSchema),
    });

    useEffect(() => {
        const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
        const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            setPlayers(playersData.filter(p => p.status === 'Active' || p.status === 'On Loan'));
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

    const handleSelectStartingXI = (player: Player) => {
        setStartingXI(prev => prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]);
        setSubstitutes(prev => prev.filter(p => p.id !== player.id));
    };

    const handleSelectSubstitute = (player: Player) => {
        setSubstitutes(prev => prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]);
        setStartingXI(prev => prev.filter(p => p.id !== player.id));
    };

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

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Create New Formation</CardTitle>
                        <CardDescription>Name your formation and pick your players for the starting lineup and the bench.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <Label htmlFor="name">Formation Name</Label>
                                <Input id="name" {...register("name")} placeholder="e.g. 4-4-2 Attacking" />
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <PlayerPicker title="Starting XI" players={players} selectedPlayers={startingXI} onSelectPlayer={handleSelectStartingXI} />
                                <PlayerPicker title="Substitutes" players={players} selectedPlayers={substitutes} onSelectPlayer={handleSelectSubstitute} />
                            </div>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Formation
                            </Button>
                         </form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Saved Formations</CardTitle>
                        <CardDescription>Your previously saved team lineups.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="animate-spin" /> : formations.length > 0 ? (
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-4">
                                    {formations.map(formation => (
                                        <Collapsible key={formation.id} className="space-y-2">
                                            <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                                                <CollapsibleTrigger asChild>
                                                    <div className="flex items-center gap-2 flex-1 cursor-pointer">
                                                        <h4 className="font-semibold">{formation.name}</h4>
                                                        <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:-rotate-180" />
                                                    </div>
                                                </CollapsibleTrigger>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
                                            <CollapsibleContent className="space-y-3 pl-4 border-l-2 ml-2">
                                                <div>
                                                    <h5 className="font-medium text-sm mb-2">Starting XI</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formation.startingXI.map(p => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h5 className="font-medium text-sm mb-2">Substitutes</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                         {formation.substitutes.map(p => <Badge key={p.id} variant="outline">{p.name}</Badge>)}
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <p className="text-sm text-center py-8 text-muted-foreground">No formations saved yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
