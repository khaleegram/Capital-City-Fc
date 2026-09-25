'use server';

/**
 * @fileOverview Turns quick bullet notes from the road into a tour diary entry.
 *
 * - generateJourneyEntry - Admin-only; requires a Firebase ID token.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {assertAdmin} from '@/lib/server/verify-admin';

const GenerateJourneyEntryInputSchema = z.object({
  journeyTitle: z.string().describe('The tour or tournament, e.g. "Gothia Cup 2026".'),
  location: z.string().optional().describe('Where the squad is today.'),
  day: z.number().optional().describe('Day number of the journey.'),
  notes: z.string().describe('Rough bullet notes written by staff on a phone.'),
});
export type GenerateJourneyEntryInput = z.infer<typeof GenerateJourneyEntryInputSchema>;

const GenerateJourneyEntryOutputSchema = z.object({
  title: z.string().describe('A short, punchy headline (max 8 words).'),
  body: z.string().describe('The diary entry, 60–160 words, in 1–3 short paragraphs.'),
});
export type GenerateJourneyEntryOutput = z.infer<typeof GenerateJourneyEntryOutputSchema>;

export async function generateJourneyEntry(idToken: string, input: GenerateJourneyEntryInput): Promise<GenerateJourneyEntryOutput> {
  await assertAdmin(idToken);
  return generateJourneyEntryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateJourneyEntryPrompt',
  input: {schema: GenerateJourneyEntryInputSchema},
  output: {schema: GenerateJourneyEntryOutputSchema},
  prompt: `You write the live tour diary for Capital City FC, a youth football academy from Abuja, Nigeria that takes its players to Europe.
Parents, scouts and fans follow the diary. Write in the club's voice: warm, confident, factual, never hype. British English.
Only use facts found in the notes. Never invent scores, names, injuries or quotes. Keep player names exactly as written.

Journey: {{{journeyTitle}}}
{{#if day}}Day: {{{day}}}{{/if}}
{{#if location}}Location: {{{location}}}{{/if}}

Notes:
{{{notes}}}`,
});

const generateJourneyEntryFlow = ai.defineFlow(
  {
    name: 'generateJourneyEntryFlow',
    inputSchema: GenerateJourneyEntryInputSchema,
    outputSchema: GenerateJourneyEntryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
