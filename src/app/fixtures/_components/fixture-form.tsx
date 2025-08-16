
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { addFixtureAndArticle, updateFixture, uploadOpponentLogo } from "@/lib/fixtures"
import { generateFixturePreview } from "@/ai/flows/generate-fixture-preview"
import type { GenerateFixturePreviewOutput } from "@/ai/flows/generate-fixture-preview"
import type { Fixture, Player, Formation } from "@/lib/data"
import Image from "next/image"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, PlusCircle, Save, UploadCloud, Users, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const fixtureSchema = z.object({
    opponent: z.string().min(2, "Opponent name is required."),
    venue: z.string().min(2, "Venue is required."),
    competition: z.string().min(2, "Competition is required."),
    date: z.date({ required_error: "Match date is required." }),
    opponentLogo: z.any().optional(),
    publishArticle: z.boolean().default(true),
    notes: z.string().optional(),
    startingXI: z.array(z.any()).optional(),
    substitutes: z.array(z.any()).optional(),
})

type FixtureFormData = z.infer<typeof fixtureSchema>

interface FixtureFormProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  fixture?: Fixture | null
}

const PlayerPicker = ({
  title, allPlayers, selectedPlayers, onTogglePlayer, maxPlayers,
}: {
  title: string
  allPlayers: Player[]
  selectedPlayers: Player[]
  onTogglePlayer: (player: Player) => void
  maxPlayers?: number
}) => {
  const availablePlayers = allPlayers.filter(p => !selectedPlayers.some(sp => sp.id === p.id))
  const canAddMore = !maxPlayers || selectedPlayers.length < maxPlayers

  return (
    <div className="rounded-xl border shadow-sm">
      <div className="p-3 border-b flex items-center justify-between bg-muted/50 rounded-t-xl">
        <h4 className="font-semibold">{title}</h4>
        <span className="text-xs text-muted-foreground">
          {selectedPlayers.length}{maxPlayers ? `/${maxPlayers}` : ""}
        </span>
      </div>
      <ScrollArea className="h-40">
        <div className="p-2 space-y-1">
          {selectedPlayers.length > 0 ? selectedPlayers.map(player => (
            <div
              key={player.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-primary/10 text-sm"
            >
              <span>{player.name}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onTogglePlayer(player)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground text-center p-4">No players selected.</p>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <ScrollArea className="h-40">
        <div className="p-2 space-y-1">
          {availablePlayers.map(player => (
            <div
              key={player.id}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm",
                canAddMore ? "hover:bg-muted" : "opacity-50"
              )}
              onClick={() => canAddMore && onTogglePlayer(player)}
            >
              <span>{player.name}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export function FixtureForm({ isOpen, setIsOpen, fixture }: FixtureFormProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [generatedContent, setGeneratedContent] = useState<GenerateFixturePreviewOutput | null>(null)
    const [editedPreview, setEditedPreview] = useState("")
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [formations, setFormations] = useState<Formation[]>([])
    const [allPlayers, setAllPlayers] = useState<Player[]>([])
    const [startingXI, setStartingXI] = useState<Player[]>([])
    const [substitutes, setSubstitutes] = useState<Player[]>([])

    const { toast } = useToast()
    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FixtureFormData>({
        resolver: zodResolver(fixtureSchema),
        defaultValues: { publishArticle: true }
    })
    
    useEffect(() => {
        const playersQuery = query(collection(db, "players"), orderBy("name", "asc"));
        const playersUnsubscribe = onSnapshot(playersQuery, (snapshot) => {
            setAllPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
        });

        const formationsQuery = query(collection(db, "formations"), orderBy("createdAt", "desc"));
        const formationsUnsubscribe = onSnapshot(formationsQuery, (snapshot) => {
            setFormations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Formation)));
        });

        return () => {
            playersUnsubscribe();
            formationsUnsubscribe();
        };
    }, []);

    useEffect(() => {
        if (fixture) {
            reset({
                ...fixture,
                date: fixture.date ? (fixture.date as any).toDate() : new Date(),
                publishArticle: !!fixture.articleId,
            });
            setStartingXI(fixture.startingXI || []);
            setSubstitutes(fixture.substitutes || []);
            setLogoPreview(fixture.opponentLogoUrl || null);
        } else {
            reset({
                opponent: "",
                venue: "",
                competition: "",
                date: new Date(),
                notes: "",
                publishArticle: true,
            });
            setStartingXI([]);
            setSubstitutes([]);
            setLogoPreview(null);
            setGeneratedContent(null);
            setEditedPreview("");
        }
    }, [fixture, reset, isOpen]);

    const handleSelectFormation = (formationId: string) => {
        const selectedFormation = formations.find(f => f.id === formationId);
        if (selectedFormation) {
            setStartingXI(selectedFormation.startingXI);
            setSubstitutes(selectedFormation.substitutes);
        }
    };

    const handleToggleStartingXI = (player: Player) => {
        setStartingXI(prev => prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]);
        setSubstitutes(prev => prev.filter(p => p.id !== player.id));
    };

    const handleToggleSubstitute = (player: Player) => {
        setSubstitutes(prev => prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]);
        setStartingXI(prev => prev.filter(p => p.id !== player.id));
    };

    const dateValue = watch("date")
    const opponentLogoFile = watch("opponentLogo")

    useEffect(() => {
        if (opponentLogoFile && opponentLogoFile[0]) {
            const file = opponentLogoFile[0]
            setLogoPreview(URL.createObjectURL(file))
        }
    }, [opponentLogoFile])

    const handleGeneratePreview = async () => {
        const formData = watch()
        if (!formData.opponent || !formData.venue || !formData.competition || !formData.date) {
            toast({
                variant: "destructive",
                title: "Missing Details",
                description: "Please fill in Opponent, Venue, Competition, and Date before generating a preview.",
            })
            return
        }
        
        setIsGenerating(true)
        try {
            const result = await generateFixturePreview({
                opponent: formData.opponent,
                venue: formData.venue,
                competition: formData.competition,
                notes: formData.notes,
            })
            setGeneratedContent(result)
            setEditedPreview(result.preview)
        } catch (error) {
            console.error("Failed to generate preview:", error)
            toast({ variant: "destructive", title: "Error", description: "Could not generate preview."})
        } finally {
            setIsGenerating(false)
        }
    }

    const onSubmit = async (data: FixtureFormData) => {
        if (!fixture && (!generatedContent || !editedPreview)) {
             toast({ variant: "destructive", title: "Error", description: "Please generate a preview before publishing a new fixture."})
             return;
        }

        setIsSubmitting(true);
        try {
            let opponentLogoUrl: string | undefined = fixture?.opponentLogoUrl;
            if (data.opponentLogo && data.opponentLogo[0]) {
                opponentLogoUrl = await uploadOpponentLogo(data.opponentLogo[0]);
            }

            const finalFixtureData = {
                ...data,
                opponentLogoUrl,
                startingXI,
                substitutes,
            };

            if (fixture) {
                // Update existing fixture
                await updateFixture(fixture.id, finalFixtureData);
                toast({ title: "Success", description: "Fixture has been updated." });
            } else {
                // Add new fixture
                await addFixtureAndArticle({
                    fixtureData: finalFixtureData,
                    preview: editedPreview,
                    tags: generatedContent!.tags,
                })
                toast({ title: "Success", description: "Fixture has been created." })
            }
            
            reset()
            setGeneratedContent(null)
            setEditedPreview("")
            setLogoPreview(null)
            setIsOpen(false)
        } catch (error) {
            console.error(error)
            toast({ variant: "destructive", title: "Error", description: `Failed to ${fixture ? 'update' : 'create'} fixture.`})
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{fixture ? "Edit Fixture" : "Create New Fixture"}</DialogTitle>
              <DialogDescription>
                {fixture ? "Update fixture details and lineup." : "Fill details to publish fixture and auto-generate a match preview."}
              </DialogDescription>
            </DialogHeader>
    
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* 🔹 Section 1: Details */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Opponent</Label>
                    <Input {...register("opponent")} placeholder="e.g. City FC" />
                    {errors.opponent && <p className="text-sm text-destructive">{errors.opponent.message}</p>}
                  </div>
                  <div>
                    <Label>Competition</Label>
                    <Input {...register("competition")} placeholder="e.g. Premier League" />
                    {errors.competition && <p className="text-sm text-destructive">{errors.competition.message}</p>}
                  </div>
                  <div>
                    <Label>AI Notes (optional)</Label>
                    <Textarea {...register("notes")} placeholder="Derby, rivalry, must-win context..." />
                  </div>
                </div>
    
                <div className="space-y-4">
                  {/* Drag & Drop Upload */}
                  <div>
                    <Label>Opponent Logo</Label>
                    <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center relative bg-muted/30 mt-1">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo preview" fill className="object-contain p-3" />
                      ) : (
                        <div className="text-center text-muted-foreground p-4">
                          <UploadCloud className="mx-auto h-10 w-10" />
                          <p className="mt-2 text-xs">Click or drag logo here</p>
                        </div>
                      )}
                      <Input type="file" accept="image/*" {...register("opponentLogo")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Input {...register("venue")} placeholder="e.g. Home Stadium" />
                    {errors.venue && <p className="text-sm text-destructive">{errors.venue.message}</p>}
                  </div>
                </div>
              </section>
    
              {/* 🔹 Section 2: Date & Time */}
              <section>
                <Label>Match Date & Time</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateValue ? format(dateValue, "PPP HH:mm") : "Pick a date & time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarPicker
                      mode="single"
                      selected={dateValue}
                      onSelect={(date) => {
                        if (!date) return
                        const newDate = new Date(date)
                        if (dateValue) {
                          newDate.setHours(dateValue.getHours())
                          newDate.setMinutes(dateValue.getMinutes())
                        }
                        setValue("date", newDate)
                      }}
                    />
                    <div className="p-2 border-t">
                      <Input
                        type="time"
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number)
                          const newDate = dateValue ? new Date(dateValue) : new Date()
                          newDate.setHours(h, m)
                          setValue("date", newDate)
                        }}
                        value={dateValue ? format(dateValue, "HH:mm") : ""}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </section>
    
              <Separator />
    
              {/* 🔹 Section 3: Lineup */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Match Lineup</h3>
                  <Select onValueChange={handleSelectFormation}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Load saved formation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formations.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PlayerPicker title="Starting XI" allPlayers={allPlayers} selectedPlayers={startingXI} onTogglePlayer={handleToggleStartingXI} maxPlayers={11} />
                  <PlayerPicker title="Substitutes" allPlayers={allPlayers} selectedPlayers={substitutes} onTogglePlayer={handleToggleSubstitute} />
                </div>
              </section>
    
              {/* 🔹 Section 4: AI Preview (only for new fixtures) */}
              {!fixture && (
                <section className="space-y-4 border rounded-xl p-4 bg-muted/20">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Wand2 className="h-5 w-5" /> AI Generated Match Preview
                  </h3>
                  <Button type="button" onClick={handleGeneratePreview} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Generate Preview
                  </Button>
                  {generatedContent && (
                    <>
                      <Textarea value={editedPreview} onChange={(e) => setEditedPreview(e.target.value)} rows={5} />
                      <div>
                        <Label>Suggested Tags</Label>
                        <p className="text-sm text-muted-foreground">{generatedContent.tags.join(", ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="publishArticle" defaultChecked onCheckedChange={(c) => setValue("publishArticle", !!c)} />
                        <Label htmlFor="publishArticle">Publish preview as news article</Label>
                      </div>
                    </>
                  )}
                </section>
              )}
    
              {/* 🔹 Footer */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || (!fixture && !generatedContent)}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {fixture ? "Save Changes" : "Publish Fixture"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )
}
