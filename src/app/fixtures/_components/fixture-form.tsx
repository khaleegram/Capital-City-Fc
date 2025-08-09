
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { addFixtureAndArticle, uploadOpponentLogo } from "@/lib/fixtures"
import { generateFixturePreview } from "@/ai/flows/generate-fixture-preview"
import type { GenerateFixturePreviewOutput } from "@/ai/flows/generate-fixture-preview"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, PlusCircle, Save, UploadCloud } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"

const fixtureSchema = z.object({
    opponent: z.string().min(2, "Opponent name is required."),
    venue: z.string().min(2, "Venue is required."),
    competition: z.string().min(2, "Competition is required."),
    date: z.date({ required_error: "Match date is required." }),
    opponentLogo: z.any().optional(),
    publishArticle: z.boolean().default(true),
    notes: z.string().optional(),
})

type FixtureFormData = z.infer<typeof fixtureSchema>

export function FixtureForm() {
    const [isOpen, setIsOpen] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [generatedContent, setGeneratedContent] = useState<GenerateFixturePreviewOutput | null>(null)
    const [editedPreview, setEditedPreview] = useState("")
    const [logoPreview, setLogoPreview] = useState<string | null>(null)

    const { toast } = useToast()
    const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FixtureFormData>({
        resolver: zodResolver(fixtureSchema),
        defaultValues: { publishArticle: true }
    })
    const dateValue = watch("date")
    const opponentLogoFile = watch("opponentLogo")

    useEffect(() => {
        if (opponentLogoFile && opponentLogoFile[0]) {
            const file = opponentLogoFile[0]
            setLogoPreview(URL.createObjectURL(file))
        } else {
            setLogoPreview(null)
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
        if (!generatedContent || !editedPreview) {
             toast({ variant: "destructive", title: "Error", description: "Please generate a preview before publishing."})
             return;
        }

        setIsSubmitting(true);
        try {
            let opponentLogoUrl: string | undefined = undefined;
            if (data.opponentLogo && data.opponentLogo[0]) {
                opponentLogoUrl = await uploadOpponentLogo(data.opponentLogo[0]);
            }

            await addFixtureAndArticle({
                fixtureData: { ...data, opponentLogoUrl },
                preview: editedPreview,
                tags: generatedContent.tags,
            })
            toast({ title: "Success", description: "Fixture has been created." })
            reset()
            setGeneratedContent(null)
            setEditedPreview("")
            setLogoPreview(null)
            setIsOpen(false)
        } catch (error) {
            console.error(error)
            toast({ variant: "destructive", title: "Error", description: "Failed to create fixture."})
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Button onClick={() => setIsOpen(true)}>
                <PlusCircle className="mr-2" /> Add New Fixture
            </Button>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">Add New Fixture</DialogTitle>
                        <DialogDescription>Enter fixture details and generate a match preview article.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="opponent">Opponent</Label>
                                    <Input id="opponent" {...register("opponent")} />
                                    {errors.opponent && <p className="text-sm text-destructive">{errors.opponent.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="competition">Competition</Label>
                                    <Input id="competition" {...register("competition")} />
                                    {errors.competition && <p className="text-sm text-destructive">{errors.competition.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="notes">Optional Notes for AI</Label>
                                    <Textarea id="notes" {...register("notes")} placeholder="e.g., Rivalry match..." />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label>Opponent Logo (Optional)</Label>
                                    <div className="aspect-square rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50 mt-1">
                                        {logoPreview ? (
                                            <Image src={logoPreview} alt="Opponent logo preview" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                                        ) : (
                                            <div className="text-center text-muted-foreground p-4">
                                                <UploadCloud className="mx-auto h-12 w-12" />
                                                <p className="mt-2 text-sm">Upload a logo</p>
                                            </div>
                                        )}
                                        <Input
                                            id="opponent-logo"
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            {...register("opponentLogo")}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="venue">Venue</Label>
                                    <Input id="venue" {...register("venue")} />
                                    {errors.venue && <p className="text-sm text-destructive">{errors.venue.message}</p>}
                                </div>
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <Label htmlFor="date">Match Date & Time</Label>
                                 <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !dateValue && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateValue ? format(dateValue, "PPP HH:mm") : <span>Pick a date and time</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarPicker
                                            mode="single"
                                            selected={dateValue}
                                            onSelect={(date) => {
                                                if (!date) return;
                                                const newDate = new Date(date);
                                                if (dateValue) {
                                                    newDate.setHours(dateValue.getHours());
                                                    newDate.setMinutes(dateValue.getMinutes());
                                                }
                                                setValue("date", newDate);
                                            }}
                                            initialFocus
                                        />
                                        <div className="p-2 border-t">
                                            <Input 
                                                type="time"
                                                onChange={(e) => {
                                                    const [hours, minutes] = e.target.value.split(':').map(Number);
                                                    const newDate = dateValue ? new Date(dateValue) : new Date();
                                                    newDate.setHours(hours, minutes);
                                                    setValue("date", newDate);
                                                }}
                                                value={dateValue ? format(dateValue, "HH:mm") : ""}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                            </div>
                         </div>
                        
                        <Button type="button" onClick={handleGeneratePreview} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Generate Preview Article
                        </Button>
                        
                        {generatedContent && (
                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-lg font-headline">Review & Publish</h3>
                                <div>
                                    <Label htmlFor="preview">Generated Preview</Label>
                                    <Textarea id="preview" value={editedPreview} onChange={(e) => setEditedPreview(e.target.value)} rows={5} />
                                </div>
                                <div>
                                    <Label>Suggested Tags</Label>
                                    <p className="text-sm text-muted-foreground">{generatedContent.tags.join(', ')}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="publishArticle" defaultChecked={true} onCheckedChange={(checked) => setValue("publishArticle", !!checked)} />
                                    <Label htmlFor="publishArticle">Publish preview as a news article</Label>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting || !generatedContent}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" /> Publish Fixture
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
