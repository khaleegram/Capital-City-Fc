
'use server';

/**
 * @fileOverview Generates a fixture preview from basic details.
 *
 * - generateFixturePreview - A function that handles generating the preview content.
 * - GenerateFixturePreviewInput - The input type for the function.
 * - GenerateFixturePreviewOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateFixturePreviewInputSchema = z.object({
  opponent: z.string().describe('The name of the opponent team.'),
  venue: z.string().describe("The venue (e.g., 'Home', 'Away', 'Wembley Stadium')."),
  competition: z.string().describe('The name of the competition (e.g., "Premier League", "FA Cup").'),
  notes: z.string().optional().describe('Optional notes from the admin (e.g., "Rivalry match").'),
  history: z.string().optional().describe('Optional brief summary of historical head-to-head data if available.'),
});
export type GenerateFixturePreviewInput = z.infer<typeof GenerateFixturePreviewInputSchema>;

const GenerateFixturePreviewOutputSchema = z.object({
  preview: z.string().describe('A short, engaging preview paragraph for the match (max 100 words).'),
  tags: z.array(z.string()).describe('A list of suggested relevant tags (e.g., opponent name, competition).'),
});
export type GenerateFixturePreviewOutput = z.infer<typeof GenerateFixturePreviewOutputSchema>;

export async function generateFixturePreview(input: GenerateFixturePreviewInput): Promise<GenerateFixturePreviewOutput> {
  return generateFixturePreviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFixturePreviewPrompt',
  input: {schema: GenerateFixturePreviewInputSchema},
  output: {schema: GenerateFixturePreviewOutputSchema},
  prompt: `You are a sports journalist for Capital City FC. Your task is to generate a short, engaging match preview and suggest relevant tags based on fixture details.

IMPORTANT RULES:
- Keep the preview concise (around 50-70 words, max 100).
- Be engaging but realistic. Do not overhype unless specified in the notes.
- ONLY use the provided historical data. DO NOT invent or fabricate past results or statistics. If no history is provided, do not mention it.

Fixture Details:
- Opponent: {{{opponent}}}
- Venue: {{{venue}}}
- Competition: {{{competition}}}
{{#if notes}}
- Admin Notes: {{{notes}}}
{{/if}}
{{#if history}}
- Head-to-Head History: {{{history}}}
{{/if}}

Generate the preview and suggest a few relevant tags (like opponent and competition).
`,
});

const generateFixturePreviewFlow = ai.defineFlow(
  {
    name: 'generateFixturePreviewFlow',
    inputSchema: GenerateFixturePreviewInputSchema,
    outputSchema: GenerateFixturePreviewOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
