"use client"

import { Player } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DroppablePlayerSlotProps {
  id: string;
  player: Player | null;
  onRemove: (player: Player) => void;
  isSubstitute?: boolean;
}

export function DroppablePlayerSlot({ id, player, onRemove, isSubstitute = false }: DroppablePlayerSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const style = {
    opacity: isOver ? 0.7 : 1,
    border: isOver ? "2px dashed hsl(var(--primary))" : isSubstitute ? "1px dashed hsl(var(--border))" : "none",
    backgroundColor: isOver ? "hsl(var(--primary) / 0.2)" : "transparent",
  };

  if (!player) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
          "aspect-square rounded-lg flex items-center justify-center border-dashed transition-all",
          isSubstitute ? 'bg-black/20 border-white/20' : 'bg-white/10'
        )}
      >
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative group/player aspect-square flex flex-col items-center justify-center text-center p-1 bg-black/40 rounded-lg transition-all",
        isSubstitute && 'bg-black/20'
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center justify-center w-full h-full">
              <div className={cn("flex items-center justify-center rounded-full font-bold text-primary-foreground", 
                isSubstitute ? "h-8 w-8 text-sm bg-primary/80" : "h-10 w-10 text-lg bg-primary"
              )}>
                  {player.jerseyNumber}
              </div>
              <p className="text-white text-[10px] sm:text-xs font-semibold mt-1 truncate max-w-full bg-black/50 px-1.5 py-0.5 rounded-sm">{player.name.split(' ').pop()}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-bold">{player.name}</p>
            <Badge className="mt-1" variant="outline">{player.position}</Badge>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover/player:opacity-100 transition-opacity z-10"
        onClick={() => onRemove(player)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}


// PlayerSlot is now just a wrapper for the visuals, used in other places like saved formations.
export function PlayerSlot({ player, isSubstitute = false }: { player: Player | null, isSubstitute?: boolean }) {
  if (!player) return null;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-1 rounded-lg text-white bg-green-700/60 transition-all duration-200",
        "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24",
        isSubstitute ? "w-12 h-12 sm:w-16 sm:h-16" : ""
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center">
              <span className="font-bold text-lg leading-none sm:text-xl md:text-2xl">{player.jerseyNumber}</span>
              <span className="text-xs leading-tight opacity-90">{player.name.split(" ")[0]}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{player.name}</p>
            <Badge className="mt-1" variant="outline">{player.position}</Badge>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
    