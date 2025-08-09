
"use client"

import { useEffect, useState, useRef } from "react"
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
import { Loader2, UploadCloud, Video, X, FileVideo } from "lucide-react"

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
  video: z.any().refine((files) => files?.length === 1, "Video is required."),
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
  const [generatedThumbnailFile, setGeneratedThumbnailFile] = useState<File | null>(null);
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

  const videoFileInput = register("video");

  // Effect to reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset()
      setThumbnailPreview(null)
      setGeneratedThumbnailFile(null)
      setSelectedPlayers([])
    }
  }, [isOpen, reset])
  
  // Effect to sync selectedPlayers with form value
  useEffect(() => {
    setValue("taggedPlayerIds", selectedPlayers.map(p => p.id));
  }, [selectedPlayers, setValue])

  const videoFile = watch("video");
  const selectedVideoName = videoFile && videoFile[0] ? videoFile[0].name : null;


  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Manually call the react-hook-form onChange handler
    videoFileInput.onChange(event); 
    const file = event.target.files?.[0];
    if (file) {
      generateThumbnail(file);
    }
  };

  const generateThumbnail = (file: File) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.style.display = "none";
    canvas.style.display = "none";

    // Mute the video to prevent autoplay sounds on some browsers
    video.muted = true;
    video.src = videoUrl;
    video.currentTime = 1; // Seek to 1 second

    video.onloadeddata = () => {
        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame on canvas
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Convert canvas to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    const thumbnailFile = new File([blob], `thumb_${file.name.split('.')[0]}.jpg`, { type: 'image/jpeg' });
                    setGeneratedThumbnailFile(thumbnailFile);
                    setThumbnailPreview(URL.createObjectURL(thumbnailFile));
                }
                URL.revokeObjectURL(videoUrl); // Clean up
            }, 'image/jpeg');
        } else {
             URL.revokeObjectURL(videoUrl); // Clean up
        }
    };
    
    video.onerror = () => {
        console.error("Error loading video for thumbnail generation.");
        toast({ variant: "destructive", title: "Thumbnail Error", description: "Could not generate thumbnail from video."})
        URL.revokeObjectURL(videoUrl);
    }
  };


  const onSubmit = async (data: VideoFormData) => {
    if (!generatedThumbnailFile) {
        toast({ variant: "destructive", title: "Error", description: "Thumbnail has not been generated yet. Please wait a moment."})
        return;
    }
    
    setIsSubmitting(true)
    try {
      const [videoUrl, thumbnailUrl] = await Promise.all([
          uploadVideoFile(data.video[0]),
          uploadThumbnailFile(generatedThumbnailFile),
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
                            {selectedVideoName ? (
                                <>
                                  <FileVideo className="mx-auto h-10 w-10 text-primary" />
                                  <span className="mt-2 block font-medium text-foreground truncate">{selectedVideoName}</span>
                                </>
                            ) : (
                                <>
                                   <Video className="mx-auto h-10 w-10 text-muted-foreground" />
                                   <span className="mt-2 block font-medium text-foreground">Click to upload a video</span>
                                </>
                            )}
                            <Input 
                                id="video" 
                                type="file" 
                                accept="video/*" 
                                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" 
                                {...videoFileInput}
                                onChange={handleVideoFileChange}
                            />
                        </div>
                        {errors.video && <p className="text-sm text-destructive mt-1">{(errors.video.message as string)}</p>}
                    </div>
                     <div>
                        <Label>Generated Thumbnail</Label>
                        <div className="aspect-video mt-1 rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                            {thumbnailPreview ? (
                                <Image src={thumbnailPreview} alt="Thumbnail preview" layout="fill" objectFit="cover" className="rounded-lg" />
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <UploadCloud className="mx-auto h-10 w-10" />
                                    <p className="mt-2 text-sm">Select a video to generate a thumbnail</p>
                                </div>
                            )}
                        </div>
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
