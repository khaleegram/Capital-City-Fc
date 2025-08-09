import { config } from 'dotenv';
config();

import '@/ai/flows/generate-match-summary.ts';
import '@/ai/flows/suggest-news-tags.ts';
import '@/ai/flows/answer-player-questions.ts';