'use server';

/**
 * @fileOverview Provides fans with answers to questions about the club, players, and news.
 *
 * - answerFanQuestion - A function that handles answering fan questions.
 * - AnswerFanQuestionInput - The input type for the function.
 * - AnswerFanQuestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerFanQuestionInputSchema = z.object({
  players: z
    .string()
    .describe("A JSON string of all player profiles."),
  newsArticles: z
    .string()
    .describe("A JSON string of all published news articles."),
  question: z.string().describe('The fan\'s question about the club.'),
});
export type AnswerFanQuestionInput = z.infer<typeof AnswerFanQuestionInputSchema>;

const AnswerFanQuestionOutputSchema = z.object({
  answer: z.string().describe('The helpful and conversational answer to the question.'),
});
export type AnswerFanQuestionOutput = z.infer<typeof AnswerFanQuestionOutputSchema>;

export async function answerFanQuestion(input: AnswerFanQuestionInput): Promise<AnswerFanQuestionOutput> {
  return answerFanQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerFanQuestionPrompt',
  input: {schema: AnswerFanQuestionInputSchema},
  output: {schema: AnswerFanQuestionOutputSchema},
  prompt: `You are the "Capital City Assistant," a friendly and knowledgeable chatbot for the Capital City FC.
Your goal is to answer fan questions based on the official club data provided.
Be conversational and helpful. If the information isn't in the data you've been given, say that you don't have that information.

Here is the data you have access to:

Available Player Profiles:
{{{players}}}

---

Published News Articles:
{{{newsArticles}}}

---

Now, please answer this fan's question:
Question: {{{question}}}
`,
});

const answerFanQuestionFlow = ai.defineFlow(
  {
    name: 'answerFanQuestionFlow',
    inputSchema: AnswerFanQuestionInputSchema,
    outputSchema: AnswerFanQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
