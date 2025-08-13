'use server';

/**
 * @fileOverview Provides scouts with well-reasoned answers to questions about players by searching through profiles and news articles using Retrieval-Augmented Generation (RAG).
 *
 * - answerPlayerQuestion - A function that handles answering questions about players.
 * - AnswerPlayerQuestionInput - The input type for the answerPlayerQuestion function.
 * - AnswerPlayerQuestionOutput - The return type for the answerPlayerQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerScoutQuestionsInputSchema = z.object({
  playerProfile: z
    .string()
    .describe("The player's profile information, including bio and stats."),
  newsArticles: z
    .string()
    .describe("Relevant news articles about the player."),
  question: z.string().describe('The question about the player.'),
});
export type AnswerScoutQuestionsInput = z.infer<typeof AnswerScoutQuestionsInputSchema>;

const AnswerScoutQuestionsOutputSchema = z.object({
  answer: z.string().describe('The well-reasoned answer to the question.'),
});
export type AnswerScoutQuestionsOutput = z.infer<typeof AnswerScoutQuestionsOutputSchema>;

export async function answerScoutQuestion(input: AnswerScoutQuestionsInput): Promise<AnswerScoutQuestionsOutput> {
  return answerScoutQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerScoutQuestionPrompt',
  input: {schema: AnswerScoutQuestionsInputSchema},
  output: {schema: AnswerScoutQuestionsOutputSchema},
  prompt: `You are an expert football scout. Use the provided player profile and news articles to answer the question about the player to the best of your ability.\n\nPlayer Profile: {{{playerProfile}}}\n\nNews Articles: {{{newsArticles}}}\n\nQuestion: {{{question}}}\n\nAnswer: `,
});

const answerScoutQuestionFlow = ai.defineFlow(
  {
    name: 'answerScoutQuestionFlow',
    inputSchema: AnswerScoutQuestionsInputSchema,
    outputSchema: AnswerScoutQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
