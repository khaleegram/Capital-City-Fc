'use server';

/**
 * @fileOverview An AI agent for suggesting relevant tags for news articles.
 *
 * - suggestNewsTags - A function that suggests tags for a given news article.
 * - SuggestNewsTagsInput - The input type for the suggestNewsTags function.
 * - SuggestNewsTagsOutput - The return type for the suggestNewsTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNewsTagsInputSchema = z.object({
  articleContent: z
    .string()
    .describe('The content of the news article to tag.'),
});
export type SuggestNewsTagsInput = z.infer<typeof SuggestNewsTagsInputSchema>;

const SuggestNewsTagsOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of suggested tags for the article.'),
});
export type SuggestNewsTagsOutput = z.infer<typeof SuggestNewsTagsOutputSchema>;

export async function suggestNewsTags(input: SuggestNewsTagsInput): Promise<SuggestNewsTagsOutput> {
  return suggestNewsTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNewsTagsPrompt',
  input: {schema: SuggestNewsTagsInputSchema},
  output: {schema: SuggestNewsTagsOutputSchema},
  prompt: `You are a content tagging expert for a sports news website.
  Your job is to suggest relevant tags for news articles so that content editors can ensure consistent content categorization and improve searchability.

  Based on the content of the article provided, suggest a list of tags that would be relevant.
  These tags should include player names, match results, and any other relevant keywords.
  Return ONLY a simple javascript array of strings.  Do not include any other text or explanation.

  Article content: {{{articleContent}}}`,
});

const suggestNewsTagsFlow = ai.defineFlow(
  {
    name: 'suggestNewsTagsFlow',
    inputSchema: SuggestNewsTagsInputSchema,
    outputSchema: SuggestNewsTagsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
