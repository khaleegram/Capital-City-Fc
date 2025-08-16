
"use client"

import type { Player } from "@/lib/data";
import Image from "next/image";
import { FormationPlayer } from "./formation-player";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FormationDisplayProps {
    teamName: string;
    startingXI: Player[];
}

// More realistic positioning based on a 100x100 grid (top, left)
const positionCoordinates: { [key: string]: { [key: number]: string } } = {
    "Goalkeeper": { 
        0: "top-[88%] left-[50%]" 
    },
    "Defender": {
        0: "top-[70%] left-[15%]", // LB
        1: "top-[75%] left-[35%]", // LCB
        2: "top-[75%] left-[65%]", // RCB
        3: "top-[70%] left-[85%]", // RB
    },
    "Midfielder": {
        0: "top-[50%] left-[15%]", // LM
        1: "top-[55%] left-[35%]", // LCM
        2: "top-[55%] left-[65%]", // RCM
        3: "top-[50%] left-[85%]", // RM
    },
    "Forward": {
        0: "top-[25%] left-[30%]", // LF
        1: "top-[25%] left-[70%]", // RF
        2: "top-[15%] left-[50%]", // ST
    },
};

const getFormationKey = (players: Player[]) => {
    if (!players || players.length === 0) return "";
    const counts = players.reduce((acc, player) => {
        if (player.position !== 'Goalkeeper') {
            acc[player.position] = (acc[player.position] || 0) + 1;
        }
        return acc;
    }, {} as { [key: string]: number });
    return `${counts['Defender'] || 0}-${counts['Midfielder'] || 0}-${counts['Forward'] || 0}`;
};


export function FormationDisplay({ teamName, startingXI }: FormationDisplayProps) {
    if (!startingXI || startingXI.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-lg">Team Lineup</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-8">
                    <p>Lineup has not been announced yet.</p>
                </CardContent>
            </Card>
        )
    }

    const groupedByPosition = startingXI.reduce((acc, player) => {
        (acc[player.position] = acc[player.position] || []).push(player);
        return acc;
    }, {} as { [key: string]: Player[] });

    const formationKey = getFormationKey(startingXI);

    return (
        <div className="space-y-4">
            <h2 className="font-headline text-2xl text-center">{teamName} Starting XI ({formationKey})</h2>
            <div className="aspect-[3/4] md:aspect-video bg-green-900/40 p-2 rounded-lg relative overflow-hidden border-2 border-green-600/30">
                <Image src="/pitch-vertical.svg" alt="Football Pitch" layout="fill" objectFit="cover" className="opacity-30" />
                <div className="relative z-10 h-full w-full">
                    {Object.entries(groupedByPosition).map(([position, players]) => (
                        players.map((player, index) => {
                             const coordinates = positionCoordinates[position]?.[index] || "top-[50%] left-[50%]";
                            return (
                                <div key={player.id} className={cn("absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300", coordinates)}>
                                    <FormationPlayer player={player} />
                                </div>
                            )
                        })
                    ))}
                </div>
            </div>
        </div>
    );
}
