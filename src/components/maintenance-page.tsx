
import Image from "next/image";
import { Wrench } from "lucide-react";
import type { TeamProfile } from "@/lib/data";

export function MaintenancePage({ profile }: { profile: TeamProfile | null }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
            <div className="space-y-4">
                {profile?.logoUrl && (
                     <Image
                        src={profile.logoUrl}
                        alt={profile.name}
                        width={100}
                        height={100}
                        className="mx-auto"
                        data-ai-hint="team logo"
                    />
                )}
                <Wrench className="mx-auto h-16 w-16 text-primary" />
                <h1 className="text-4xl font-headline font-bold">
                    Under Maintenance
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Our website is currently undergoing scheduled maintenance. We should be back shortly. Thank you for your patience.
                </p>
                {profile?.name && (
                    <p className="text-lg font-semibold">{profile.name}</p>
                )}
            </div>
        </div>
    );
}
