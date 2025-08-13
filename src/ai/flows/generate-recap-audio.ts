'use server';

/**
 * @fileOverview Generates audio commentary from match recap text.
 *
 * - generateRecapAudio - A function that converts text to speech.
 * - GenerateRecapAudioInput - The input type for the function.
 * - GenerateRecapAudioOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';

const GenerateRecapAudioInputSchema = z.object({
  recapText: z.string().describe('The full text of the match recap to be converted to audio.'),
});
export type GenerateRecapAudioInput = z.infer<typeof GenerateRecapAudioInputSchema>;

const GenerateRecapAudioOutputSchema = z.object({
  audioUrl: z.string().describe("A data URI of the generated WAV audio file. Format: 'data:audio/wav;base64,<encoded_data>'."),
});
export type GenerateRecapAudioOutput = z.infer<typeof GenerateRecapAudioOutputSchema>;

export async function generateRecapAudio(input: GenerateRecapAudioInput): Promise<GenerateRecapAudioOutput> {
  return generateRecapAudioFlow(input);
}

const generateRecapAudioFlow = ai.defineFlow(
  {
    name: 'generateRecapAudioFlow',
    inputSchema: GenerateRecapAudioInputSchema,
    outputSchema: GenerateRecapAudioOutputSchema,
  },
  async ({ recapText }) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }, // A good, clear voice for commentary
          },
        },
      },
      prompt: recapText,
    });

    if (!media) {
      throw new Error('No audio media was returned from the AI model.');
    }

    const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
    const wavData = await toWav(audioBuffer);
    
    return {
      audioUrl: 'data:audio/wav;base64,' + wavData,
    };
  }
);

/**
 * Converts raw PCM audio data to a base64 encoded WAV string.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData);
    writer.end();
  });
}
