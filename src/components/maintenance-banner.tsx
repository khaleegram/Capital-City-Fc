
import { AlertTriangle } from 'lucide-react';

export function MaintenanceBanner() {
    return (
        <div className="bg-yellow-500 text-yellow-900 p-2 text-center text-sm font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Maintenance Mode is currently active. The site is not visible to the public.</span>
        </div>
    );
}
