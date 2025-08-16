
'use server';

/**
 * @fileOverview Generates engaging live event text from structured data.
 *
 * - generateEventText - A function that handles the text generation.
 * - GenerateEventTextInput - The input type for the function.
 * - GenerateEventTextOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateEventTextInputSchema = z.object({
  eventType: z.enum(["Goal", "Red Card", "Substitution"]),
  teamName: z.string().describe("The name of the team the event relates to."),
  homeScore: z.number().optional().describe("The new score for the home team (if applicable)."),
  awayScore: z.number().optional().describe("The new score for the away team (if applicable)."),
  playerName: z.string().optional().describe("The primary player involved (e.g., scorer, player carded)."),
  assistPlayerName: z.string().optional().describe("The player who assisted the goal."),
  subOffPlayerName: z.string().optional().describe("The player being substituted off."),
  subOnPlayerName: z.string().optional().describe("The player coming on as a substitute."),
});
export type GenerateEventTextInput = z.infer<typeof GenerateEventTextInputSchema>;

export const GenerateEventTextOutputSchema = z.object({
  eventText: z.string().describe('A single, engaging sentence describing the event for a live match feed.'),
});
export type GenerateEventTextOutput = z.infer<typeof GenerateEventTextOutputSchema>;

export async function generateEventText(input: GenerateEventTextInput): Promise<GenerateEventTextOutput> {
  return generateEventTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEventTextPrompt',
  input: {schema: GenerateEventTextInputSchema},
  output: {schema: GenerateEventTextOutputSchema},
  prompt: `You are a live match commentator for the Capital City FC.
Your task is to take structured data about a match event and turn it into a single, exciting sentence for a live feed.
Keep it short, punchy, and professional.

Here is the event data. Create a suitable eventText based on the eventType.

- Event Type: {{{eventType}}}
- Team Name: {{{teamName}}}
{{#if homeScore}}- Home Score: {{{homeScore}}}{{/if}}
{{#if awayScore}}- Away Score: {{{awayScore}}}{{/if}}
{{#if playerName}}- Player Name: {{{playerName}}}{{/if}}
{{#if assistPlayerName}}- Assisting Player: {{{assistPlayerName}}}{{/if}}
{{#if subOffPlayerName}}- Player Off: {{{subOffPlayerName}}}{{/if}}
{{#if subOnPlayerName}}- Player On: {{{subOnPlayerName}}}{{/if}}

Examples:
- Goal: "GOAL for Capital City FC! {{{playerName}}} finds the back of the net, assisted by {{{assistPlayerName}}}. The score is now {{{homeScore}}}-{{{awayScore}}}."
- Substitution: "Substitution for Capital City FC: {{{subOnPlayerName}}} comes on to replace {{{subOffPlayerName}}}."
- Red Card: "RED CARD! {{{playerName}}} has been sent off, leaving Capital City FC with 10 players."

Generate the live feed update now based on the provided event data.
`,
});

const generateEventTextFlow = ai.defineFlow(
  {
    name: 'generateEventTextFlow',
    inputSchema: GenerateEventTextInputSchema,
    outputSchema: GenerateEventTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
