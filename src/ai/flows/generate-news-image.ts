'use server';

/**
 * @fileOverview Generates a news image from a text prompt.
 *
 * - generateNewsImage - A function that handles generating the image.
 * - GenerateNewsImageInput - The input type for the function.
 * - GenerateNewsImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateNewsImageInputSchema = z.object({
  prompt: z.string().describe('The text prompt to generate an image from, based on an article headline.'),
});
export type GenerateNewsImageInput = z.infer<typeof GenerateNewsImageInputSchema>;

const GenerateNewsImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a data URI. Format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateNewsImageOutput = z.infer<typeof GenerateNewsImageOutputSchema>;

export async function generateNewsImage(input: GenerateNewsImageInput): Promise<GenerateNewsImageOutput> {
  return generateNewsImageFlow(input);
}

const generateNewsImageFlow = ai.defineFlow(
  {
    name: 'generateNewsImageFlow',
    inputSchema: GenerateNewsImageInputSchema,
    outputSchema: GenerateNewsImageOutputSchema,
  },
  async ({ prompt }) => {
    const { media } = await ai.generate({
        model: 'googleai/gemini-2.0-flash-preview-image-generation',
        prompt: `A dramatic, high-quality, cinematic photo related to the following sports news headline: "${prompt}". The image should be suitable for a professional sports news website. No text or logos in the image.`,
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!media) {
        throw new Error('No image was returned from the AI model.');
    }

    return { imageDataUri: media.url };
  }
);
