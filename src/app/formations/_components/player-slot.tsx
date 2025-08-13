
"use client"

import { Player } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { X, Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DroppablePlayerSlotProps {
  id: string;
  player: Player | null;
  onRemove: (player: Player) => void;
  isSubstitute?: boolean;
  showPulse?: boolean;
}

export function DroppablePlayerSlot({ id, player, onRemove, isSubstitute = false, showPulse = false }: DroppablePlayerSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  if (!player) {
    return (
      <div 
        ref={setNodeRef} 
        className={cn(
          "aspect-square rounded-full flex items-center justify-center border-dashed border-2 border-white/20 bg-black/20 transition-all duration-200",
          isSubstitute ? "w-14 h-14" : "w-16 h-16 sm:w-20 sm:h-20",
          isOver && "border-primary scale-110 bg-primary/20",
          showPulse && !isOver && "animate-pulse border-primary"
        )}
      >
        <Shirt className={cn("transition-colors", isSubstitute ? "h-5 w-5" : "h-6 w-6", isOver ? "text-primary" : "text-white/30" )} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative group/player aspect-square flex flex-col items-center justify-center text-center p-1 rounded-full transition-all duration-200",
        isSubstitute ? "w-14 h-14" : "w-16 h-16 sm:w-20 sm:h-20",
        isOver ? "ring-2 ring-primary" : ""
      )}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center justify-center w-full h-full bg-primary/90 text-primary-foreground rounded-full shadow-lg">
              <span className={cn("font-bold", isSubstitute ? "text-lg" : "text-xl sm:text-2xl")}>
                  {player.jerseyNumber}
              </span>
              <p className="text-white/80 font-semibold truncate max-w-full leading-tight" style={{ fontSize: isSubstitute ? '0.6rem' : '0.7rem' }}>
                {player.name.split(' ').pop()}
              </p>
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

// Kept for other potential uses, but DroppablePlayerSlot is primary for the manager
export function PlayerSlot({ player, isSubstitute = false }: { player: Player | null, isSubstitute?: boolean }) {
  if (!player) return null;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-1 rounded-lg text-white bg-green-700/60",
        isSubstitute ? "w-16 h-16" : "w-24 h-24"
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl md:text-2xl">{player.jerseyNumber}</span>
              <span className="text-xs opacity-90">{player.name.split(" ")[0]}</span>
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

    