
"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from "next/image"

import { addVideoWithTags, uploadThumbnailFile, uploadVideoFile } from "@/lib/videos"
import type { Player } from "@/lib/data"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, UploadCloud, Video, X } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"

const videoSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  video: z.any().refine(file => file?.length == 1, "Video is required."),
  thumbnail: z.any().refine(file => file?.length == 1, "Thumbnail is required."),
  taggedPlayerIds: z.array(z.string()).optional(),
})

type VideoFormData = z.infer<typeof videoSchema>

interface VideoFormProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  players: Player[]
}

export function VideoForm({ isOpen, setIsOpen, players }: VideoFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      title: "",
      description: "",
      taggedPlayerIds: [],
    },
  })

  // Effect to reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setThumbnailPreview(null)
      setSelectedPlayers([])
    }
  }, [isOpen, reset])
  
  // Effect for thumbnail preview
  const thumbnailField = watch("thumbnail")
  useEffect(() => {
    if (thumbnailField && thumbnailField[0]) {
      const file = thumbnailField[0]
      setThumbnailPreview(URL.createObjectURL(file))
    } else {
        setThumbnailPreview(null)
    }
  }, [thumbnailField])

  // Effect to sync selectedPlayers with form value
  useEffect(() => {
    setValue("taggedPlayerIds", selectedPlayers.map(p => p.id));
  }, [selectedPlayers, setValue])


  const onSubmit = async (data: VideoFormData) => {
    setIsSubmitting(true)
    try {
      const [videoUrl, thumbnailUrl] = await Promise.all([
          uploadVideoFile(data.video[0]),
          uploadThumbnailFile(data.thumbnail[0]),
      ]);

      const videoPayload = { 
        title: data.title,
        description: data.description,
        videoUrl, 
        thumbnailUrl 
      }
      
      const taggedPlayers = data.taggedPlayerIds ? players.filter(p => data.taggedPlayerIds!.includes(p.id)) : [];

      await addVideoWithTags(videoPayload, taggedPlayers)
      
      toast({
        title: "Success",
        description: "Video uploaded and tagged successfully.",
      })
      setIsOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to upload video.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Video</DialogTitle>
          <DialogDescription>
            Upload a video file, provide details, and optionally tag players.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <Label>Video File</Label>
                        <div className="relative mt-1 block w-full appearance-none rounded-md border border-dashed border-input bg-background px-3 py-10 text-center text-sm transition focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:border-primary/50">
                            <Video className="mx-auto h-10 w-10 text-muted-foreground" />
                            <span className="mt-2 block font-medium text-foreground">Click to upload a video</span>
                            <Input id="video" type="file" accept="video/*" className="absolute inset-0 h-full w-full opacity-0" {...register("video")} />
                        </div>
                        {errors.video && <p className="text-sm text-destructive mt-1">{(errors.video.message as string)}</p>}
                    </div>
                     <div>
                        <Label>Thumbnail Image</Label>
                        <div className="aspect-video mt-1 rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                            {thumbnailPreview ? (
                                <Image src={thumbnailPreview} alt="Thumbnail preview" layout="fill" objectFit="cover" className="rounded-lg" />
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <UploadCloud className="mx-auto h-10 w-10" />
                                    <p className="mt-2 text-sm">Upload a thumbnail</p>
                                </div>
                            )}
                            <Input
                                id="thumbnail"
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                {...register("thumbnail")}
                            />
                        </div>
                        {errors.thumbnail && <p className="text-sm text-destructive mt-1">{(errors.thumbnail.message as string)}</p>}
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="title">Video Title</Label>
                        <Input id="title" {...register("title")} />
                        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                    </div>
                     <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" {...register("description")} rows={5} />
                        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                    </div>
                    <div>
                        <Label>Tag Players (Optional)</Label>
                        <Command className="rounded-lg border">
                            <div className="flex flex-wrap gap-1 p-2 bg-background rounded-t-lg min-h-[40px]">
                                {selectedPlayers.map(player => (
                                    <Badge key={player.id} variant="secondary">
                                    {player.name}
                                    <button
                                        type="button"
                                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                        onClick={() => setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id))}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                    </Badge>
                                ))}
                            </div>
                            <CommandInput placeholder="Search for a player to tag..." />
                            <CommandList>
                                <CommandEmpty>No players found.</CommandEmpty>
                                <CommandGroup>
                                {players.filter(p => !selectedPlayers.find(sp => sp.id === p.id)).map((player) => (
                                    <CommandItem
                                        key={player.id}
                                        value={player.name}
                                        onSelect={() => {
                                            if (!selectedPlayers.find(p => p.id === player.id)) {
                                                setSelectedPlayers([...selectedPlayers, player])
                                            }
                                        }}
                                    >
                                    {player.name}
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                        {errors.taggedPlayerIds && <p className="text-sm text-destructive mt-1">{errors.taggedPlayerIds.message}</p>}
                    </div>
                </div>
            </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Video
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
