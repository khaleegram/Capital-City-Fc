'use server';

/**
 * @fileOverview Generates concise match summaries from raw text input.
 *
 * - generateMatchSummary - A function that generates match summaries.
 * - GenerateMatchSummaryInput - The input type for the generateMatchSummary function.
 * - GenerateMatchSummaryOutput - The return type for the generateMatchSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMatchSummaryInputSchema = z.object({
  rawText: z.string().describe('Raw text of the match.'),
});

export type GenerateMatchSummaryInput = z.infer<typeof GenerateMatchSummaryInputSchema>;

const GenerateMatchSummaryOutputSchema = z.object({
  summary: z.string().describe('Concise and engaging match summary.'),
});

export type GenerateMatchSummaryOutput = z.infer<typeof GenerateMatchSummaryOutputSchema>;

export async function generateMatchSummary(input: GenerateMatchSummaryInput): Promise<GenerateMatchSummaryOutput> {
  return generateMatchSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMatchSummaryPrompt',
  input: {schema: GenerateMatchSummaryInputSchema},
  output: {schema: GenerateMatchSummaryOutputSchema},
  prompt: `You are an expert sports journalist specializing in creating concise and engaging summaries of soccer/football matches.

  Given the following raw text of a match, extract key data points like goal scorers, final scores, and any other important highlights to create a summary that allows fans to quickly catch up on games they missed.

  Raw Text: {{{rawText}}}

  Summary:`,
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
