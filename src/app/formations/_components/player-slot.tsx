
"use client"

import type { Player } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMinus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayerSlotProps {
    player: Player | null;
    isSubstitute?: boolean;
    onRemove: (player: Player) => void;
    onAssign: () => void;
}

export function PlayerSlot({ player, isSubstitute = false, onRemove, onAssign }: PlayerSlotProps) {
    if (!player) {
        return (
            <button 
                type="button" 
                onClick={onAssign}
                className={`group aspect-square rounded-full flex items-center justify-center ${isSubstitute ? 'bg-black/20' : 'bg-white/10'} border border-dashed border-white/20 hover:bg-white/25 hover:border-white transition-colors`}
            >
                <Plus className="h-5 w-5 text-white/50 group-hover:text-white" />
            </button>
        );
    }

    return (
        <div className="relative group/player aspect-square flex flex-col items-center justify-center text-center">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-white/80">
                <AvatarImage src={player.imageUrl} alt={player.name} />
                <AvatarFallback className="text-sm sm:text-base">{player.jerseyNumber}</AvatarFallback>
            </Avatar>
            <p className="text-white text-[10px] sm:text-xs font-bold mt-1 truncate bg-black/50 px-1 rounded max-w-[50px] sm:max-w-[70px]">{player.name}</p>
            <Button 
                type="button"
                size="icon" 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover/player:opacity-100 transition-opacity z-10"
                onClick={() => onRemove(player)}
            >
                <UserMinus className="h-3 w-3" />
            </Button>
        </div>
    );
}

    