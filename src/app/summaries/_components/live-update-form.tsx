
"use client"

import { useState, useEffect } from "react"
import { generateMatchSummary } from "@/ai/flows/generate-match-summary"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { postLiveUpdate } from "@/lib/fixtures"
import type { Fixture } from "@/lib/data"


import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Wand2, Send, Mic } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const updateSchema = z.object({
  homeScore: z.coerce.number().min(0),
  awayScore: z.coerce.number().min(0),
  status: z.enum(["UPCOMING", "LIVE", "FT"]),
  eventText: z.string().min(5, "Event description is required."),
  eventType: z.enum(["Goal", "Red Card", "Match End", "Info"]),
  noteForAI: z.string().optional(),
})

type UpdateFormData = z.infer<typeof updateSchema>

interface LiveUpdateFormProps {
    fixture: Fixture;
}

export function LiveUpdateForm({ fixture }: LiveUpdateFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
        homeScore: fixture.score.home,
        awayScore: fixture.score.away,
        status: fixture.status,
        eventType: "Info",
    }
  })

  useEffect(() => {
    reset({
        homeScore: fixture.score.home,
        awayScore: fixture.score.away,
        status: fixture.status,
        eventType: "Info",
        eventText: "",
        noteForAI: "",
    })
  }, [fixture, reset])

  const noteForAI = watch("noteForAI")

  const handleGenerate = async () => {
    if (!noteForAI?.trim()) return
    setIsGenerating(true)
    try {
      const result = await generateMatchSummary({ note: noteForAI })
      setValue("eventText", result.update)
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate update. Please try again.",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePostUpdate = async (data: UpdateFormData) => {
    setIsPosting(true);
    try {
        await postLiveUpdate(fixture.id, data);
        toast({ title: "Success", description: "Live update posted!" });
        setValue("noteForAI", "");
        setValue("eventText", "");
    } catch(error) {
        console.error("Error posting update:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to post update."});
    } finally {
        setIsPosting(false);
    }
  }
  
  if (!user) return null;

  return (
    <Card className="border-primary border-2">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Mic className="text-primary"/> Admin: Post Live Update</CardTitle>
        <CardDescription>Update score, status, and post an event to the live feed for this match.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handlePostUpdate)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Score & Status */}
                <div className="space-y-4">
                    <div>
                        <Label>Score</Label>
                        <div className="flex items-center gap-4">
                            <Input type="number" placeholder="Home" {...register("homeScore")} />
                            <span className="font-bold">-</span>
                            <Input type="number" placeholder="Away" {...register("awayScore")} />
                        </div>
                    </div>
                    <div>
                       <Label>Match Status</Label>
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="flex items-center space-x-4 mt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="UPCOMING" id="upcoming" />
                                        <Label htmlFor="upcoming">Upcoming</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="LIVE" id="live" />
                                        <Label htmlFor="live">Live</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="FT" id="ft" />
                                        <Label htmlFor="ft">Full Time</Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />
                    </div>
                </div>
                {/* Event Details */}
                <div className="space-y-4">
                     <div>
                       <Label>Event Type</Label>
                        <Controller
                            name="eventType"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="flex items-center space-x-4 mt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Info" id="info" />
                                        <Label htmlFor="info">Info</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Goal" id="goal" />
                                        <Label htmlFor="goal">Goal</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Red Card" id="redcard" />
                                        <Label htmlFor="redcard">Red Card</Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />
                    </div>
                     <div>
                        <Label htmlFor="noteForAI">Quick Note for AI</Label>
                        <div className="flex items-center gap-2">
                            <Input id="noteForAI" {...register("noteForAI")} placeholder="e.g., Rivera scores a header" />
                            <Button type="button" onClick={handleGenerate} disabled={isGenerating || !noteForAI?.trim()} variant="outline" size="icon">
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div>
              <Label htmlFor="eventText">Event Text for Feed</Label>
              <Textarea
                id="eventText"
                {...register("eventText")}
                placeholder="The text that will appear in the live feed. You can use the AI to generate it."
                rows={3}
              />
              {errors.eventText && <p className="text-sm text-destructive mt-1">{errors.eventText.message}</p>}
            </div>

            <Button type="submit" disabled={isPosting}>
                {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Post Update
            </Button>
        </form>
      </CardContent>
    </Card>
  )
}
