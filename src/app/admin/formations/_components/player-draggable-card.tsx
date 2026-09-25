import { Player } from "@/lib/data";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { GripVertical } from "lucide-react";

interface PlayerDraggableCardProps {
  player: Player;
}

export function PlayerDraggableCard({ player }: PlayerDraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: player.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-md flex items-center gap-3 transition-all",
        "bg-background hover:bg-muted",
        isDragging ? "opacity-50 cursor-grabbing scale-105 shadow-lg" : "cursor-grab"
      )}
    >
      <div {...listeners} {...attributes} className="p-1 touch-none cursor-grab">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <Image src={player.imageUrl} alt={player.name} width={40} height={40} className="rounded-full w-10 h-10 object-cover" />
      <div className="flex-1">
        <p className="font-semibold text-sm">{player.name}</p>
        <p className="text-xs opacity-80">{player.position}</p>
      </div>
      <Badge variant="outline">{player.jerseyNumber}</Badge>
    </div>
  );
}
    