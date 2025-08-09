'use server';

/**
 * @fileOverview Generates a news article from a list of bullet points.
 *
 * - generateNewsArticle - A function that generates a news article.
 * - GenerateNewsArticleInput - The input type for the generateNewsArticle function.
 * - GenerateNewsArticleOutput - The return type for the generateNewsArticle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewsArticleInputSchema = z.object({
  bulletPoints: z
    .string()
    .describe('A string containing bullet points, typically separated by newlines.'),
});
export type GenerateNewsArticleInput = z.infer<typeof GenerateNewsArticleInputSchema>;

const GenerateNewsArticleOutputSchema = z.object({
  article: z.string().describe('The full news article generated from the bullet points.'),
});
export type GenerateNewsArticleOutput = z.infer<typeof GenerateNewsArticleOutputSchema>;

export async function generateNewsArticle(input: GenerateNewsArticleInput): Promise<GenerateNewsArticleOutput> {
  return generateNewsArticleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNewsArticlePrompt',
  input: {schema: GenerateNewsArticleInputSchema},
  output: {schema: GenerateNewsArticleOutputSchema},
  prompt: `You are an expert sports journalist for Capital City FC.
Your task is to write a compelling, ready-to-publish news article based on the provided bullet points.
The article should be engaging, well-structured, and capture the excitement of the match or event.
Expand on the bullet points to create a full narrative.

Bullet Points:
{{{bulletPoints}}}

Generated Article:
`,
});

const generateNewsArticleFlow = ai.defineFlow(
  {
    name: 'generateNewsArticleFlow',
    inputSchema: GenerateNewsArticleInputSchema,
    outputSchema: GenerateNewsArticleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
