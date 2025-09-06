'use server';

/**
 * @fileOverview Generates a short highlight video for a player using their image.
 *
 * - generatePlayerHighlightsVideo - A function that generates the video.
 * - GeneratePlayerHighlightsVideoInput - The input type for the function.
 * - GeneratePlayerHighlightsVideoOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GeneratePlayerHighlightsVideoInputSchema = z.object({
  playerImageUri: z
    .string()
    .describe(
      "The player's profile image as a data URI. Format: 'data:image/jpeg;base64,<encoded_data>'."
    ),
  playerName: z.string().describe('The name of the player.'),
});
export type GeneratePlayerHighlightsVideoInput = z.infer<typeof GeneratePlayerHighlightsVideoInputSchema>;

const GeneratePlayerHighlightsVideoOutputSchema = z.object({
  videoUrl: z.string().describe('A data URI of the generated MP4 video file.'),
});
export type GeneratePlayerHighlightsVideoOutput = z.infer<typeof GeneratePlayerHighlightsVideoOutputSchema>;


export async function generatePlayerHighlightsVideo(input: GeneratePlayerHighlightsVideoInput): Promise<GeneratePlayerHighlightsVideoOutput> {
  return generatePlayerHighlightsVideoFlow(input);
}

const generatePlayerHighlightsVideoFlow = ai.defineFlow(
  {
    name: 'generatePlayerHighlightsVideoFlow',
    inputSchema: GeneratePlayerHighlightsVideoInputSchema,
    outputSchema: GeneratePlayerHighlightsVideoOutputSchema,
  },
  async ({ playerImageUri, playerName }) => {

    const { operation } = await ai.generate({
        model: 'googleai/veo-2.0-generate-001',
        prompt: [
            { text: `Create a short, energetic sports highlight video of the player in this photo, ${playerName}. Include dynamic motion, lens flares, and a cheering crowd sound effect. The video should feel exciting and professional.` },
            { media: { url: playerImageUri, contentType: 'image/jpeg' } },
        ],
        config: {
            durationSeconds: 6,
            aspectRatio: '16:9',
        }
    });

    if (!operation) {
        throw new Error("Video generation did not start.");
    }
    
    // Poll for completion
    let result = operation;
    while (!result.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds
        result = await ai.checkOperation(result);
    }
    
    if (result.error) {
        throw new Error(`Video generation failed: ${result.error.message}`);
    }

    const videoPart = result.output?.message?.content.find(p => !!p.media && p.media.contentType === 'video/mp4');
    
    if (!videoPart || !videoPart.media) {
      throw new Error('No video was returned from the AI model.');
    }

    return { videoUrl: videoPart.media.url };
  }
);
