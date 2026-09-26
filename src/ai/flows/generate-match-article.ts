'use server';

/**
 * @fileOverview Writes a match report from the facts the app already holds.
 *
 * Unlike `generate-match-recap`, which is handed a human's raw notes and asked to interpret
 * them, this is given the match as structured data — the score, the result, the scorers, the
 * timeline — because the app knows all of it. Nothing is inferred from prose, so there is much
 * less room to invent a goal that never happened.
 *
 * The one thing the model is asked to supply is the writing: the headline, the opening
 * summary, and the body. The facts are pinned in the prompt and it is told, explicitly, not to
 * add to them.
 *
 * `src/lib/match-article.ts` holds a deterministic writer that produces a perfectly serviceable
 * report with no model at all. That is the fallback, so a match always ends up with news even
 * when the AI is unavailable.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateMatchArticleInputSchema = z.object({
  teamName: z.string().describe('The club publishing the report, e.g. "Capital City FC".'),
  opponent: z.string(),
  competition: z.string(),
  venue: z.string().optional(),
  date: z.string().optional().describe('Human-readable date of the match.'),
  result: z.enum(['W', 'D', 'L']).describe('Did the club win, draw or lose.'),
  scoreFor: z.number(),
  scoreAgainst: z.number(),
  scorers: z.array(z.string()).optional().describe('Players who scored for the club, in order.'),
  assists: z.array(z.string()).optional(),
  timeline: z
    .array(z.string())
    .optional()
    .describe('Pre-formatted lines such as "67\' Goal — Baba Saidu Audu". Do not reformat these.'),
  notes: z.string().optional().describe("The club's own notes about the match, if any."),
  journeyTitle: z.string().optional().describe('The tour or campaign this match belonged to.'),
  stage: z.string().optional().describe("The round, e.g. 'Group 5' or 'Play-off A · 1/16'."),
});
export type GenerateMatchArticleInput = z.infer<typeof GenerateMatchArticleInputSchema>;

const GenerateMatchArticleOutputSchema = z.object({
  headline: z
    .string()
    .describe('A short, concrete headline. No clickbait. Name the opponent and the score.'),
  summary: z
    .string()
    .describe('One or two sentences for a news feed. Suitable as a social description.'),
  body: z.string().describe('The article itself: three to five short paragraphs.'),
  tags: z.array(z.string()).describe('Four to six tags: opponent, competition, scorers, round.'),
});
export type GenerateMatchArticleOutput = z.infer<typeof GenerateMatchArticleOutputSchema>;

export async function generateMatchArticle(
  input: GenerateMatchArticleInput
): Promise<GenerateMatchArticleOutput> {
  return generateMatchArticleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMatchArticlePrompt',
  input: { schema: GenerateMatchArticleInputSchema },
  output: { schema: GenerateMatchArticleOutputSchema },
  prompt: `You are the club writer for {{teamName}}, a Nigerian player-development club in Abuja.

Write the match report for the game below.

THE FACTS — these are the only facts you may use:
- Fixture: {{teamName}} vs {{opponent}}
- Competition: {{competition}}{{#if stage}} · {{stage}}{{/if}}{{#if journeyTitle}} ({{journeyTitle}}){{/if}}
- Venue: {{venue}}
- Date: {{date}}
- Full time: {{teamName}} {{scoreFor}}–{{scoreAgainst}} {{opponent}} ({{result}})
- Scorers: {{#if scorers}}{{#each scorers}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}not recorded{{/if}}
- Assists: {{#if assists}}{{#each assists}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}not recorded{{/if}}
{{#if timeline}}
- Timeline:
{{#each timeline}}  · {{this}}
{{/each}}
{{/if}}
{{#if notes}}
The club's own notes, which you may draw on:
{{notes}}
{{/if}}

RULES:
- Do NOT invent goals, scorers, minutes, cards, attendances, quotes or statistics. If a fact is
  not above, leave it out. The score and the scorers are exact.
- Write in the third person, past tense, about {{teamName}} as "Capital City" after first mention.
- Be plain and specific. No "in a thrilling encounter", no "the lads", no hype adjectives.
- The body should be three to five short paragraphs: the result, then how it went using the
  timeline and scorers, then what it means for the tournament or season.
- If the club lost, say so directly and without euphemism. Do not call a defeat a "learning
  experience" or a draw "a share of the spoils".
- Tags are short, lowercase or title-case nouns: the opponent, the competition, the round, the
  scorer surnames, and the result.
`,
});

const generateMatchArticleFlow = ai.defineFlow(
  {
    name: 'generateMatchArticleFlow',
    inputSchema: GenerateMatchArticleInputSchema,
    outputSchema: GenerateMatchArticleOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
