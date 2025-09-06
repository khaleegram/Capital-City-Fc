
"use client"

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { sendCustomNotification } from "@/lib/team";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

const notificationSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters long.").max(50, "Title is too long."),
    body: z.string().min(10, "Message must be at least 10 characters long.").max(150, "Message is too long."),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export function NotificationComposer() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const { register, handleSubmit, reset, formState: { errors } } = useForm<NotificationFormData>({
        resolver: zodResolver(notificationSchema),
    });

    const onSubmit = async (data: NotificationFormData) => {
        setIsSubmitting(true);
        try {
            await sendCustomNotification(data.title, data.body);
            toast({
                title: "Success!",
                description: "Your notification has been sent to all users.",
            });
            reset();
        } catch (error) {
            console.error("Failed to send notification:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send the notification." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Notification Composer</CardTitle>
                <CardDescription>Send a custom push notification to all subscribed fans.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="title">Notification Title</Label>
                        <Input id="title" {...register("title")} placeholder="e.g. Special Announcement" />
                        {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                    </div>
                     <div>
                        <Label htmlFor="body">Message</Label>
                        <Textarea id="body" {...register("body")} placeholder="e.g. Tickets for the final match go on sale tomorrow at 9 AM!" />
                        {errors.body && <p className="text-sm text-destructive mt-1">{errors.body.message}</p>}
                    </div>
                     <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send Notification
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
