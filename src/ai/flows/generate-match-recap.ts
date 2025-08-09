'use server';

/**
 * @fileOverview Generates a full match recap from raw notes.
 *
 * - generateMatchRecap - A function that generates a full match recap.
 * - GenerateMatchRecapInput - The input type for the generateMatchRecap function.
 * - GenerateMatchRecapOutput - The return type for the generateMatchRecap function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateMatchRecapInputSchema = z.object({
  matchNotes: z.string().describe('The raw notes or bullet points from the match.'),
});
export type GenerateMatchRecapInput = z.infer<typeof GenerateMatchRecapInputSchema>;

const MatchEventSchema = z.object({
    minute: z.string().describe("The minute of the event (e.g., '45+1', '89'). Use 'TBD' if not specified."),
    type: z.enum(["Goal", "Assist", "Yellow Card", "Red Card", "Substitution", "Penalty Saved", "Penalty Missed", "Info"]).describe("The type of event."),
    player: z.string().describe("The name of the player involved. Use 'N/A' if not applicable."),
    description: z.string().describe("A brief description of the event."),
});

const StructuredDataSchema = z.object({
    finalScore: z.string().describe("The final score (e.g., '3-0'). Use 'TBD' if not specified."),
    goalScorers: z.array(z.string()).describe("A list of goal scorers."),
    assists: z.array(z.string()).describe("A list of players who made an assist."),
});

const GenerateMatchRecapOutputSchema = z.object({
  headline: z.string().describe('A catchy and concise headline for the match.'),
  shortSummary: z.string().describe('A 1-2 sentence recap of the match, suitable for a news feed.'),
  fullRecap: z.string().describe('A well-written, fact-based article summarizing the match.'),
  timeline: z.array(MatchEventSchema).describe('A chronological list of key events in the match.'),
  structuredData: StructuredDataSchema.describe('Structured data containing key match statistics.'),
});
export type GenerateMatchRecapOutput = z.infer<typeof GenerateMatchRecapOutputSchema>;


export async function generateMatchRecap(input: GenerateMatchRecapInput): Promise<GenerateMatchRecapOutput> {
  return generateMatchRecapFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateMatchRecapPrompt',
    input: { schema: GenerateMatchRecapInputSchema },
    output: { schema: GenerateMatchRecapOutputSchema },
    prompt: `You are an expert sports journalist for Capital City FC.
Your task is to take raw match notes and transform them into a complete and structured match report.
Analyze the provided notes and generate all the required components.

IMPORTANT:
- Only use information available in the notes. Do not fabricate or guess stats, scores, or events.
- If a piece of information (like assists, cards, or specific minutes) is not mentioned, leave the corresponding fields in the output empty or null.
- The timeline should be in chronological order.

Match Notes:
{{{matchNotes}}}

Please generate the full report based on these notes.
`,
});


const generateMatchRecapFlow = ai.defineFlow(
  {
    name: 'generateMatchRecapFlow',
    inputSchema: GenerateMatchRecapInputSchema,
    outputSchema: GenerateMatchRecapOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
