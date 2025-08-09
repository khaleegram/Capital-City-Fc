
'use server';

/**
 * @fileOverview Generates social media posts from a news article.
 *
 * - generateSocialPost - A function that generates social media posts.
 * - GenerateSocialPostInput - The input type for the generateSocialPost function.
 * - GenerateSocialPostOutput - The return type for the generateSocialPost function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSocialPostInputSchema = z.object({
  articleContent: z.string().describe('The full content of the news article.'),
  tags: z.array(z.string()).describe('A list of relevant tags for the article.'),
});
export type GenerateSocialPostInput = z.infer<typeof GenerateSocialPostInputSchema>;

const GenerateSocialPostOutputSchema = z.object({
  twitterPost: z.string().describe('A social media post optimized for Twitter, including hashtags.'),
  instagramPost: z.string().describe('A social media post optimized for Instagram, including hashtags.'),
});
export type GenerateSocialPostOutput = z.infer<typeof GenerateSocialPostOutputSchema>;

export async function generateSocialPost(input: GenerateSocialPostInput): Promise<GenerateSocialPostOutput> {
  return generateSocialPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSocialPostPrompt',
  input: {schema: GenerateSocialPostInputSchema},
  output: {schema: GenerateSocialPostOutputSchema},
  prompt: `You are a social media manager for the Capital City FC.
Your task is to create engaging social media posts based on the provided news article.
Use the article content and tags to generate posts for Twitter and Instagram.
The tone should be exciting and engaging for fans.
Use relevant hashtags based on the tags provided.

Article Content:
{{{articleContent}}}

Tags:
{{#each tags}}- {{{this}}}{{/each}}

Please generate the social media posts.
`,
});

const generateSocialPostFlow = ai.defineFlow(
  {
    name: 'generateSocialPostFlow',
    inputSchema: GenerateSocialPostInputSchema,
    outputSchema: GenerateSocialPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
