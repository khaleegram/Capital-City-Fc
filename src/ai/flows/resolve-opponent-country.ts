'use server';

/**
 * @fileOverview Places an opponent club in a country, so a fixture for a club with no
 * published crest can fall back to that country's flag.
 *
 * - resolveOpponentCountry - the server action the fixture form calls.
 * - ResolveOpponentCountryInput / Output - the input and output types.
 */

import {ai, preferredModel} from '@/ai/genkit';
import {z} from 'zod';

const ResolveOpponentCountryInputSchema = z.object({
  opponent: z.string().describe("The opponent club's name."),
});
export type ResolveOpponentCountryInput = z.infer<typeof ResolveOpponentCountryInputSchema>;

const ResolveOpponentCountryOutputSchema = z.object({
  country: z.string().describe('The country name in English, e.g. "Nigeria". Empty when the club cannot be placed.'),
  countryCode: z
    .string()
    .describe(
      'Lowercase ISO 3166-1 alpha-2 code, e.g. "ng", "se", "dk". For a club in one of the UK ' +
        'home nations use "gb-eng", "gb-sct", "gb-wls" or "gb-nir". Empty when the club cannot be placed.'
    ),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('How certain the placement is. Use "low" rather than guessing.'),
});
export type ResolveOpponentCountryOutput = z.infer<typeof ResolveOpponentCountryOutputSchema>;

export async function resolveOpponentCountry(
  input: ResolveOpponentCountryInput
): Promise<ResolveOpponentCountryOutput> {
  return resolveOpponentCountryFlow(input);
}

/**
 * Only the club's name goes to the model.
 *
 * The fixture's competition and venue were passed here once and had to be removed: Capital City
 * FC are Nigerian and travel to youth tournaments abroad, so a Dana Cup fixture is played on
 * Danish pitches by clubs from anywhere. Offered a Danish venue the model answered "Denmark" at
 * high confidence — including for Våg FK, a Norwegian club — and warning it off the inference
 * just made every club come back low. The name alone gets Våg FK right.
 */
const prompt = ai.definePrompt({
  name: 'resolveOpponentCountryPrompt',
  model: preferredModel(),
  input: {schema: ResolveOpponentCountryInputSchema},
  output: {schema: ResolveOpponentCountryOutputSchema},
  prompt: `You place football clubs in their country from the club's name.

Rules:
- Work from the name and the language it is written in: a Norwegian club's name often shows it, as does a Nigerian or Danish one.
- Answer with the English country name plus its lowercase ISO 3166-1 alpha-2 code: "Nigeria" is "ng", "Sweden" is "se", "Denmark" is "dk".
- The UK is the exception: an English club is "gb-eng", a Scottish one "gb-sct", a Welsh one "gb-wls", a Northern Irish one "gb-nir". Never answer plain "gb" for these.
- If the name is generic, invented, or a local club you do not actually recognise, answer with an empty country and code and confidence "low".
- NEVER guess. A missing flag is harmless; a wrong flag misrepresents the opponent, which is worse than no flag at all.

Club: {{{opponent}}}
`,
});

const resolveOpponentCountryFlow = ai.defineFlow(
  {
    name: 'resolveOpponentCountryFlow',
    inputSchema: ResolveOpponentCountryInputSchema,
    outputSchema: ResolveOpponentCountryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
