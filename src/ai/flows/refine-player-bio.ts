
'use server';

/**
 * @fileOverview Refines a player's biography to be more descriptive and engaging.
 *
 * - refinePlayerBio - A function that rewrites a player's bio.
 * - RefinePlayerBioInput - The input type for the function.
 * - RefinePlayerBioOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinePlayerBioInputSchema = z.object({
  originalBio: z.string().describe("The original, raw biography of the player."),
});
export type RefinePlayerBioInput = z.infer<typeof RefinePlayerBioInputSchema>;

const RefinePlayerBioOutputSchema = z.object({
  refinedBio: z.string().describe("The refined, professionally written biography."),
});
export type RefinePlayerBioOutput = z.infer<typeof RefinePlayerBioOutputSchema>;

export async function refinePlayerBio(input: RefinePlayerBioInput): Promise<RefinePlayerBioOutput> {
  return refinePlayerBioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refinePlayerBioPrompt',
  input: {schema: RefinePlayerBioInputSchema},
  output: {schema: RefinePlayerBioOutputSchema},
  prompt: `You are a professional sports journalist tasked with writing player profiles for Capital City FC.
A club administrator has provided a raw biography for a player. Your job is to rewrite it into a more engaging, professional, and descriptive narrative suitable for the official club website.
Preserve all key facts and information, but enhance the language, structure, and flow. If the original bio contains interesting comparisons or details (e.g., "plays like..."), elaborate on them to create a compelling story.

Original Bio:
{{{originalBio}}}

Rewrite the bio now.`,
});

const refinePlayerBioFlow = ai.defineFlow(
  {
    name: 'refinePlayerBioFlow',
    inputSchema: RefinePlayerBioInputSchema,
    outputSchema: RefinePlayerBioOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
