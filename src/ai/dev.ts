import { config } from 'dotenv';
config();

import '@/ai/flows/generate-match-summary.ts';
import '@/ai/flows/suggest-news-tags.ts';
import '@/ai/flows/answer-player-questions.ts';
import '@/ai/flows/generate-news-article.ts';
import '@/ai/flows/generate-match-recap.ts';
import '@/ai/flows/generate-social-post.ts';
import '@/ai/flows/generate-fixture-preview.ts';
import '@/ai/flows/answer-fan-questions.ts';
import '@/ai/flows/generate-player-highlights.ts';
import '@/ai/flows/generate-recap-audio.ts';
