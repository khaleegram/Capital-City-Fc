import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {deepSeek} from '@genkit-ai/compat-oai/deepseek';

/** The model every flow falls back to when DeepSeek isn't configured. */
export const GEMINI_MODEL = 'googleai/gemini-2.0-flash';

/** DeepSeek's general chat model (V3). `deepseek-reasoner` (R1) is available too. */
export const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';

/**
 * DeepSeek is reached through the OpenAI-compatible plugin: its API speaks the same
 * chat-completions protocol, so `deepseek/deepseek-chat` behaves like any other Genkit model
 * and a flow can switch to it by changing one string.
 *
 * The plugin throws at construction when no key is present, and this module is imported by
 * every AI flow — registering it unconditionally would take the whole site down over a
 * missing environment variable. So it is only added when DEEPSEEK_API_KEY is set, and
 * `preferredModel()` keeps flows working on Gemini until then.
 */
export const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);

/**
 * The model a flow should reach for first: DeepSeek where it is configured, Gemini where it
 * is not. Use this instead of a hardcoded model string so adding the key is the only step
 * needed to move a flow over.
 */
export function preferredModel(): string {
  return hasDeepSeek ? DEEPSEEK_MODEL : GEMINI_MODEL;
}

export const ai = genkit({
  plugins: [googleAI(), ...(hasDeepSeek ? [deepSeek()] : [])],
  /*
   * Every text flow omits `model` and lands here, so this one line moves previews, recaps,
   * news, social posts, tags, Q&A and bios onto DeepSeek together. The recap audio flow names
   * its own Gemini TTS model and is deliberately unaffected — DeepSeek has no speech model.
   */
  model: preferredModel(),
});
