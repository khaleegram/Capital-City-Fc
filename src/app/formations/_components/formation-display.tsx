
"use client"

import type { Player } from "@/lib/data";
import Image from "next/image";
import { FormationPlayer } from "./formation-player";

interface FormationDisplayProps {
    teamName: string;
    startingXI: Player[];
}

const positionCoordinates: { [key: string]: { [key: number]: string } } = {
    "Goalkeeper": { 0: "row-start-5 col-start-3" },
    "Defender": {
        0: "row-start-4 col-start-1", // LB
        1: "row-start-4 col-start-2", // LCB
        2: "row-start-4 col-start-4", // RCB
        3: "row-start-4 col-start-5", // RB
    },
    "Midfielder": {
        0: "row-start-3 col-start-1", // LM
        1: "row-start-3 col-start-2", // LCM
        2: "row-start-3 col-start-4", // RCM
        3: "row-start-3 col-start-5", // RM
    },
    "Forward": {
        0: "row-start-2 col-start-2", // LF
        1: "row-start-2 col-start-4", // RF
        2: "row-start-1 col-start-3", // ST
    },
};

const getFormationKey = (players: Player[]) => {
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

    // TODO: Add more sophisticated formation detection and coordinate mapping
    // This is a simple placeholder implementation
    const formationKey = getFormationKey(startingXI);

    return (
        <div className="space-y-4">
            <h2 className="font-headline text-2xl text-center">{teamName} Starting XI ({formationKey})</h2>
            <div className="aspect-[4/3] bg-green-800/20 p-2 rounded-lg relative overflow-hidden">
                <Image src="/pitch-vertical.svg" alt="Football Pitch" layout="fill" objectFit="cover" className="opacity-20" />
                <div className="relative z-10 grid grid-cols-5 grid-rows-5 h-full w-full">
                    {Object.entries(groupedByPosition).map(([position, players]) => (
                        players.map((player, index) => {
                             const coordinates = positionCoordinates[position]?.[index] || "row-start-1 col-start-1";
                            return (
                                <div key={player.id} className={coordinates}>
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

    