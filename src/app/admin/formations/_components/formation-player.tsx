
"use client"

import type { Player } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FormationPlayerProps {
    player?: Player;
}

export function FormationPlayer({ player }: FormationPlayerProps) {
    if (!player) return null;

    const displayName = player.nickname || player.name.split(' ').pop();

    return (
        <div className="relative group/player flex flex-col items-center justify-center text-center w-full h-full">
            <div className="relative">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary-foreground relative shadow-lg">
                    <AvatarImage src={player.imageUrl} alt={player.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{player.jerseyNumber}</AvatarFallback>
                </Avatar>
            </div>
            <div className="mt-1.5 text-center">
                 <p className="text-white text-[10px] sm:text-xs font-bold leading-tight bg-black/60 px-1.5 py-0.5 rounded-sm shadow-lg truncate max-w-[60px] sm:max-w-[80px]">{displayName}</p>
            </div>
        </div>
    );
}
