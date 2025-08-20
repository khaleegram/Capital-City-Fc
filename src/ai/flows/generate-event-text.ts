
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

const GenerateEventTextInputSchema = z.object({
  eventType: z.enum(["Goal", "Red Card", "Substitution", "Match Start", "Half Time", "Second Half Start", "Match End"]),
  teamName: z.string().optional().describe("The name of the team the event relates to."),
  opponentName: z.string().optional().describe("The name of the opponent team."),
  homeScore: z.number().optional().describe("The new score for the home team (if applicable)."),
  awayScore: z.number().optional().describe("The new score for the away team (if applicable)."),
  playerName: z.string().optional().describe("The primary player involved (e.g., scorer, player carded)."),
  assistPlayerName: z.string().optional().describe("The player who assisted the goal."),
  subOffPlayerName: z.string().optional().describe("The player being substituted off."),
  subOnPlayerName: z.string().optional().describe("The player coming on as a substitute."),
});
export type GenerateEventTextInput = z.infer<typeof GenerateEventTextInputSchema>;

const GenerateEventTextOutputSchema = z.object({
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
  prompt: `You are a live match commentator for a football club.
Your task is to take structured data about a match event and turn it into a single, exciting sentence for a live feed.
Keep it short, punchy, and professional.

Here is the event data. Create a suitable eventText based on the eventType.

- Event Type: {{{eventType}}}
{{#if teamName}}- Team Name: {{{teamName}}}{{/if}}
{{#if opponentName}}- Opponent Name: {{{opponentName}}}{{/if}}
{{#if homeScore}}- Home Score: {{{homeScore}}}{{/if}}
{{#if awayScore}}- Away Score: {{{awayScore}}}{{/if}}
{{#if playerName}}- Player Name: {{{playerName}}}{{/if}}
{{#if assistPlayerName}}- Assisting Player: {{{assistPlayerName}}}{{/if}}
{{#if subOffPlayerName}}- Player Off: {{{subOffPlayerName}}}{{/if}}
{{#if subOnPlayerName}}- Player On: {{{subOnPlayerName}}}{{/if}}

Examples:
- Goal: "GOAL for {{{teamName}}}! {{{playerName}}} finds the back of the net, assisted by {{{assistPlayerName}}}. The score is now {{{homeScore}}}-{{{awayScore}}}."
- Substitution: "Substitution for {{{teamName}}}: {{{subOnPlayerName}}} comes on to replace {{{subOffPlayerName}}}."
- Red Card: "RED CARD! {{{playerName}}} has been sent off, leaving {{{teamName}}} with 10 players."
- Match Start: "The match between {{{teamName}}} and {{{opponentName}}} has kicked off!"
- Half Time: "The referee blows for half-time. Score is {{{teamName}}} {{{homeScore}}} - {{{awayScore}}} {{{opponentName}}}."
- Second Half Start: "The second half is underway!"
- Match End: "The final whistle has blown! Full time score: {{{teamName}}} {{{homeScore}}} - {{{awayScore}}} {{{opponentName}}}."

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
