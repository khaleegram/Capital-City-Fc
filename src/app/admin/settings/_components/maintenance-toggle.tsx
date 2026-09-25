
"use client"
import { useState, useEffect } from "react";
import { TeamProfile } from "@/lib/data";
import { updateTeamProfile } from "@/lib/team";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function MaintenanceToggle({ profile }: { profile: TeamProfile }) {
    const [isActive, setIsActive] = useState(profile.maintenanceMode || false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setIsActive(profile.maintenanceMode || false);
    }, [profile]);

    const handleToggle = async () => {
        setIsSubmitting(true);
        try {
            await updateTeamProfile({ maintenanceMode: !isActive });
            setIsActive(!isActive);
            toast({
                title: "Success!",
                description: `Maintenance mode has been ${!isActive ? 'enabled' : 'disabled'}.`,
            });
        } catch (error) {
            console.error("Failed to toggle maintenance mode:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update maintenance status." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Maintenance Mode</CardTitle>
                <CardDescription>
                    When enabled, only logged-in admins can access the site. Public visitors will see a maintenance page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-4">
                    <Switch
                        id="maintenance-mode"
                        checked={isActive}
                        onCheckedChange={handleToggle}
                        disabled={isSubmitting}
                    />
                    <Label htmlFor="maintenance-mode" className="text-base">
                        {isSubmitting ? "Updating..." : (isActive ? "Maintenance Mode is ON" : "Maintenance Mode is OFF")}
                    </Label>
                    {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
            </CardContent>
        </Card>
    );
}
