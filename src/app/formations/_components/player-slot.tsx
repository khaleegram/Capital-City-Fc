
"use client"

import type { Player } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMinus, Plus, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
                className={cn(
                    "group aspect-square rounded-lg flex items-center justify-center border border-dashed transition-colors",
                    isSubstitute ? 'bg-black/20 border-white/20 hover:bg-white/25 hover:border-white' : 'bg-white/10 border-white/20 hover:bg-white/25 hover:border-white'
                )}
            >
                <Plus className="h-5 w-5 text-white/50 group-hover:text-white" />
            </button>
        );
    }

    return (
        <div className="relative group/player aspect-square flex flex-col items-center justify-center text-center p-1 bg-black/20 rounded-lg">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white/80">
                <AvatarImage src={player.imageUrl} alt={player.name} />
                <AvatarFallback className="text-sm sm:text-base bg-primary text-primary-foreground">{player.jerseyNumber}</AvatarFallback>
            </Avatar>
            <p className="text-white text-[10px] sm:text-xs font-bold mt-1 truncate max-w-full">{player.name}</p>
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

    