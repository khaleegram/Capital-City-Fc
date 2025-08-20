
"use client"

import { useEffect, useState } from "react"
import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from "next/image"

import {
  addPlayer,
  updatePlayer,
  uploadPlayerImage,
} from "@/lib/players"
import type { Player } from "@/lib/data"
import { generatePlayerHighlights } from "@/ai/flows/generate-player-highlights"
import { refinePlayerBio } from "@/ai/flows/refine-player-bio"


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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, UploadCloud, Wand2, PlusCircle, Trash2, Save } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const playerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  position: z.enum(["Goalkeeper", "Defender", "Midfielder", "Forward", "Coach", "Staff"]),
  role: z.enum(["Player", "Coach", "Staff"]),
  status: z.enum(["Active", "Injured", "On Loan", "Former Player"]).optional(),
  jerseyNumber: z.coerce.number().int().min(0, "Jersey number must be 0 or greater."),
  bio: z.string().min(10, "Bio must be at least 10 characters."),
  strongFoot: z.enum(["Left", "Right", "Both"]).optional(),
  stats: z.object({
    appearances: z.coerce.number().int().min(0),
    goals: z.coerce.number().int().min(0),
    assists: z.coerce.number().int().min(0),
  }),
  careerHighlights: z.array(z.object({ value: z.string().min(1, "Highlight cannot be empty.") })).optional(),
  image: z.any().optional(),
})

type PlayerFormData = z.infer<typeof playerSchema>

interface PlayerFormProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  player?: Player | null
}

export function PlayerForm({ isOpen, setIsOpen, player }: PlayerFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(player?.imageUrl || null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: "",
      position: "Forward",
      role: "Player",
      status: "Active",
      jerseyNumber: 99,
      bio: "",
      stats: { appearances: 0, goals: 0, assists: 0 },
      careerHighlights: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "careerHighlights",
  });

  useEffect(() => {
    if (player) {
      reset({
        ...player,
        status: player.status || "Active",
        strongFoot: player.strongFoot || undefined,
        careerHighlights: player.careerHighlights?.map(h => ({ value: h })) || [],
      })
      setImagePreview(player.imageUrl)
    } else {
      reset({
        name: "",
        position: "Forward",
        role: "Player",
        status: "Active",
        jerseyNumber: 99,
        bio: "",
        strongFoot: undefined,
        stats: { appearances: 0, goals: 0, assists: 0 },
        careerHighlights: [],
      })
      setImagePreview(null)
    }
  }, [player, reset, isOpen])

  const imageField = watch("image")
  useEffect(() => {
    if (imageField && imageField[0]) {
      const file = imageField[0]
      setImagePreview(URL.createObjectURL(file))
    }
  }, [imageField])


  const handleAiAssist = async () => {
    const { name, bio, stats } = getValues();
    if (!name || !bio) {
        toast({
            variant: "destructive",
            title: "Missing Info",
            description: "Please fill out the player's name and bio first.",
        });
        return;
    }

    setIsGenerating(true);
    try {
        const [highlightsResult, bioResult] = await Promise.all([
            generatePlayerHighlights({
                playerName: name,
                playerBio: bio,
                playerStats: JSON.stringify(stats),
            }),
            refinePlayerBio({ originalBio: bio })
        ]);

        const newHighlights = highlightsResult.highlights.map(h => ({ value: h }));
        replace(newHighlights); 

        setValue("bio", bioResult.refinedBio);

        toast({ title: "Success", description: "Bio and highlights have been refined!" });
    } catch (error) {
        console.error("Failed to generate AI content:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not generate AI content." });
    } finally {
        setIsGenerating(false);
    }
  };

  const onSubmit = async (data: PlayerFormData) => {
    setIsSubmitting(true)
    try {
      let imageUrl = player?.imageUrl || ""
      if (data.image && data.image[0]) {
        imageUrl = await uploadPlayerImage(data.image[0], player?.id)
      }

      if (!imageUrl && !player?.imageUrl) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Player image is required.",
        })
        setIsSubmitting(false)
        return
      }

      const { image, ...restOfData } = data;
      
      const playerPayload: Partial<Player> = { 
        ...restOfData, 
        imageUrl, 
        careerHighlights: data.careerHighlights?.map(h => h.value) || [],
        status: data.status || "Active",
        strongFoot: data.strongFoot || undefined,
      };

      if (player) {
        await updatePlayer(player.id, playerPayload)
        toast({
          title: "Success",
          description: "Player profile updated.",
        })
      } else {
        await addPlayer(playerPayload)
        toast({ title: "Success", description: "Player created." })
      }
      setIsOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${player ? "update" : "create"} player.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const role = watch("role");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {player ? "Edit Member Profile" : "Create New Club Member"}
          </DialogTitle>
          <DialogDescription>
            {player
              ? "Update the details for this person."
              : "Enter the details for the new player, coach, or staff member."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-2">
                  <Label>Photo</Label>
                  <div className="aspect-square rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50">
                      {imagePreview ? (
                          <Image src={imagePreview} alt="Member preview" layout="fill" objectFit="cover" className="rounded-lg" />
                      ) : (
                          <div className="text-center text-muted-foreground">
                              <UploadCloud className="mx-auto h-12 w-12" />
                              <p className="mt-2 text-sm">Upload an image</p>
                          </div>
                      )}
                      <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          {...register("image")}
                      />
                  </div>
                  {errors.image && (
                      <p className="text-sm text-destructive">{(errors.image.message as string) || "An image is required."}</p>
                  )}
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="role">Role</Label>
                        <Controller
                          name="role"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Player">Player</SelectItem>
                                <SelectItem value="Coach">Coach</SelectItem>
                                <SelectItem value="Staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                    </div>
                    <div>
                        <Label htmlFor="status">Status</Label>
                         <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || "Active"}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Active">Active</SelectItem>
                                  <SelectItem value="Injured">Injured</SelectItem>
                                  <SelectItem value="On Loan">On Loan</SelectItem>
                                  <SelectItem value="Former Player">Former Player</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                    </div>
                 </div>

                {role === 'Player' && (
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                          <Label htmlFor="jerseyNumber">Jersey Number</Label>
                          <Input id="jerseyNumber" type="number" {...register("jerseyNumber")} />
                          {errors.jerseyNumber && <p className="text-sm text-destructive">{errors.jerseyNumber.message}</p>}
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="position">Position</Label>
                        <Controller
                          name="position"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a position" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Goalkeeper">Goalkeeper</SelectItem>
                                <SelectItem value="Defender">Defender</SelectItem>
                                <SelectItem value="Midfielder">Midfielder</SelectItem>
                                <SelectItem value="Forward">Forward</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.position && <p className="text-sm text-destructive">{errors.position.message}</p>}
                      </div>
                    </div>
                )}
               
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" {...register("bio")} rows={5} />
                  {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
                </div>
              </div>
          </div>

          {role === 'Player' && (
            <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-headline text-lg">Player Stats</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="appearances">Appearances</Label>
                        <Input id="appearances" type="number" {...register("stats.appearances")} />
                        {errors.stats?.appearances && <p className="text-sm text-destructive">{errors.stats.appearances.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="goals">Goals</Label>
                        <Input id="goals" type="number" {...register("stats.goals")} />
                        {errors.stats?.goals && <p className="text-sm text-destructive">{errors.stats.goals.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="assists">Assists</Label>
                        <Input id="assists" type="number" {...register("stats.assists")} />
                        {errors.stats?.assists && <p className="text-sm text-destructive">{errors.stats.assists.message}</p>}
                    </div>
                  </div>
                </div>

              <Separator />

              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline text-lg">Career Highlights & Bio</h3>
                    <Button type="button" variant="outline" size="sm" onClick={handleAiAssist} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Refine with AI
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <Input {...register(`careerHighlights.${index}.value`)} placeholder={`Highlight #${index + 1}`} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    {errors.careerHighlights && <p className="text-sm text-destructive">{errors.careerHighlights.message}</p>}
                  </div>
                   <Button type="button" variant="secondary" size="sm" onClick={() => append({ value: "" })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Highlight
                    </Button>
              </div>
            </>
          )}


          <DialogFooter className="col-span-1 md:col-span-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {player ? "Save Changes" : "Create Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
