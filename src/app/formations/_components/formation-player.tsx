
"use client"

import type { Player } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FormationPlayerProps {
    player?: Player;
}

export function FormationPlayer({ player }: FormationPlayerProps) {
    if (!player) return null;

    return (
        <div className="relative group/player flex flex-col items-center justify-center text-center w-full h-full">
            <div className="relative">
                <div className="absolute -inset-1 bg-primary rounded-full blur-sm opacity-60"></div>
                <Avatar className="h-12 w-12 border-2 border-primary-foreground relative">
                    <AvatarImage src={player.imageUrl} alt={player.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{player.jerseyNumber}</AvatarFallback>
                </Avatar>
            </div>
            <div className="mt-1.5 text-center">
                 <p className="text-white text-xs font-bold leading-tight bg-black/50 px-1.5 py-0.5 rounded-sm shadow-lg truncate max-w-[70px]">{player.name}</p>
                 <p className="text-white/80 text-[10px] font-semibold">{player.position}</p>
            </div>
        </div>
    );
}

    