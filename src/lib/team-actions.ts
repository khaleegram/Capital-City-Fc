'use server';

import { uploadFileToR2 } from "./r2";

/**
 * Uploads the team's logo to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadTeamLogo = async (imageFile: File): Promise<string> => {
    return uploadFileToR2(imageFile, 'team/logos');
};
