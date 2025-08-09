'use server';

/**
 * @fileOverview Generates a list of career highlights for a player based on their profile.
 *
 * - generatePlayerHighlights - A function that generates career highlights.
 * - GeneratePlayerHighlightsInput - The input type for the function.
 * - GeneratePlayerHighlightsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePlayerHighlightsInputSchema = z.object({
  playerBio: z.string().describe("The player's biography."),
  playerStats: z.string().describe("A JSON string of the player's key stats (appearances, goals, assists)."),
  playerName: z.string().describe("The name of the player."),
});
export type GeneratePlayerHighlightsInput = z.infer<typeof GeneratePlayerHighlightsInputSchema>;

const GeneratePlayerHighlightsOutputSchema = z.object({
  highlights: z.array(z.string()).describe("A list of 3-5 concise career highlights."),
});
export type GeneratePlayerHighlightsOutput = z.infer<typeof GeneratePlayerHighlightsOutputSchema>;

export async function generatePlayerHighlights(input: GeneratePlayerHighlightsInput): Promise<GeneratePlayerHighlightsOutput> {
  return generatePlayerHighlightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePlayerHighlightsPrompt',
  input: {schema: GeneratePlayerHighlightsInputSchema},
  output: {schema: GeneratePlayerHighlightsOutputSchema},
  prompt: `You are a sports journalist creating a player profile for Capital City FC.
Based on the provided biography and statistics for {{playerName}}, generate a list of 3-5 engaging and concise career highlights.
Focus on significant achievements, milestones, or key attributes mentioned in the text.

Player Name: {{{playerName}}}
Player Bio: {{{playerBio}}}
Player Stats: {{{playerStats}}}

Generate the highlights now.`,
});

const generatePlayerHighlightsFlow = ai.defineFlow(
  {
    name: 'generatePlayerHighlightsFlow',
    inputSchema: GeneratePlayerHighlightsInputSchema,
    outputSchema: GeneratePlayerHighlightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
