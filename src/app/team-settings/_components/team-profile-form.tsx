
"use client"

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";

import { useToast } from "@/hooks/use-toast";
import type { TeamProfile } from "@/lib/data";
import { updateTeamProfile } from "@/lib/team";
import { uploadTeamLogo } from "@/lib/team-actions";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, UploadCloud } from "lucide-react";

const profileSchema = z.object({
    name: z.string().min(3, "Team name is required."),
    homeVenue: z.string().min(3, "Home venue is required."),
    logo: z.any().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface TeamProfileFormProps {
    profile: TeamProfile;
}

export function TeamProfileForm({ profile }: TeamProfileFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(profile.logoUrl);
    const { toast } = useToast();

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: profile.name,
            homeVenue: profile.homeVenue,
        },
    });

    useEffect(() => {
        reset({
            name: profile.name,
            homeVenue: profile.homeVenue,
        });
        setLogoPreview(profile.logoUrl);
    }, [profile, reset]);

    const logoFile = watch("logo");
    useEffect(() => {
        if (logoFile && logoFile[0]) {
            const file = logoFile[0];
            setLogoPreview(URL.createObjectURL(file));
        }
    }, [logoFile]);

    const onSubmit = async (data: ProfileFormData) => {
        setIsSubmitting(true);
        try {
            let logoUrl = profile.logoUrl;
            if (data.logo && data.logo[0]) {
                logoUrl = await uploadTeamLogo(data.logo[0]);
            }
            
            await updateTeamProfile({ 
                name: data.name,
                homeVenue: data.homeVenue,
                logoUrl: logoUrl,
            });

            toast({
                title: "Success!",
                description: "Team profile has been updated.",
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to update profile:", errorMessage);
            toast({ variant: "destructive", title: "Error", description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Club Information</CardTitle>
                <CardDescription>This information will be used across the app.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2 md:col-span-1">
                            <Label>Club Logo</Label>
                            <div className="aspect-square rounded-lg border-dashed border-2 flex items-center justify-center relative bg-muted/50 mt-1">
                                {logoPreview ? (
                                    <Image src={logoPreview} alt="Team logo preview" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                                ) : (
                                    <div className="text-center text-muted-foreground p-4">
                                        <UploadCloud className="mx-auto h-12 w-12" />
                                        <p className="mt-2 text-sm">Upload a logo</p>
                                    </div>
                                )}
                                <Input
                                    id="team-logo"
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    {...register("logo")}
                                />
                            </div>
                        </div>
                        <div className="space-y-4 md:col-span-2">
                             <div>
                                <Label htmlFor="name">Club Name</Label>
                                <Input id="name" {...register("name")} />
                                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="homeVenue">Home Venue</Label>
                                <Input id="homeVenue" {...register("homeVenue")} />
                                {errors.homeVenue && <p className="text-sm text-destructive">{errors.homeVenue.message}</p>}
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
