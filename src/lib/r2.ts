'use server';

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.R2_ENDPOINT ||
    !process.env.R2_PUBLIC_URL
) {
    console.warn("Cloudflare R2 environment variables are not fully configured. File operations may fail.");
}

const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;


/**
 * Uploads a file to Cloudflare R2 and returns its public URL.
 * @param file The file to upload.
 * @param path The sub-path within the bucket (e.g., 'images/players').
 * @returns The public URL of the uploaded file.
 */
export const uploadFileToR2 = async (file: File, path: string): Promise<string> => {
    const key = `${path}/${uuidv4()}_${file.name}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
    });

    await S3.send(command);

    return `${R2_PUBLIC_URL}/${key}`;
};

/**
 * Deletes a file from Cloudflare R2 based on its public URL.
 * @param url The public URL of the file to delete.
 */
export const deleteFileFromR2 = async (url: string | undefined): Promise<void> => {
    if (!url || !R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
        console.warn("URL is invalid or does not match R2 public URL, skipping deletion:", url);
        return;
    }

    const key = url.substring(R2_PUBLIC_URL.length + 1);

    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    try {
        await S3.send(command);
    } catch (error: any) {
         if (error.name === 'NoSuchKey') {
            console.warn(`File not found in R2 for deletion: ${key}`);
        } else {
            console.error("Error deleting file from R2:", error);
            throw new Error(`Failed to delete file from R2: ${key}`);
        }
    }
};
