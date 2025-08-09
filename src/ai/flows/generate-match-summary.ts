'use server';

/**
 * @fileOverview Enhances a brief match update note into a concise, engaging sentence for a live feed.
 *
 * - generateMatchSummary - A function that handles the enhancement.
 * - GenerateMatchSummaryInput - The input type for the function.
 * - GenerateMatchSummaryOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMatchSummaryInputSchema = z.object({
  note: z.string().describe('A brief note about a match event (e.g., "Rivera goal 55 min", "Smith yellow card").'),
});
export type GenerateMatchSummaryInput = z.infer<typeof GenerateMatchSummaryInputSchema>;

const GenerateMatchSummaryOutputSchema = z.object({
  update: z.string().describe('A single, engaging sentence for a live match feed.'),
});
export type GenerateMatchSummaryOutput = z.infer<typeof GenerateMatchSummaryOutputSchema>;

export async function generateMatchSummary(input: GenerateMatchSummaryInput): Promise<GenerateMatchSummaryOutput> {
  return generateMatchSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMatchSummaryPrompt',
  input: {schema: GenerateMatchSummaryInputSchema},
  output: {schema: GenerateMatchSummaryOutputSchema},
  prompt: `You are a live match commentator for Capital City FC.
Your task is to take a very brief note about a match event and expand it into a single, exciting sentence for a live feed.
Keep it short and punchy.

Note: {{{note}}}

Live Feed Update:`,
});

const generateMatchSummaryFlow = ai.defineFlow(
  {
    name: 'generateMatchSummaryFlow',
    inputSchema: GenerateMatchSummaryInputSchema,
    outputSchema: GenerateMatchSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
