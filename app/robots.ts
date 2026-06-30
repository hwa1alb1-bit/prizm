import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/site'

// Bots that respect robots.txt and crawl pages to train LLMs, build retrieval indexes,
// or surface as conversational search. We block them site-wide; the marketing site is
// already indexed by Googlebot / Bingbot, which we keep allowed.
const AI_TRAINING_AND_RETRIEVAL_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'FacebookBot',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'ImagesiftBot',
  'Diffbot',
  'Omgilibot',
  'YouBot',
  'Amazonbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'DuckAssistBot',
] as const

export default function robots(): MetadataRoute.Robots {
  const productDisallow = ['/app/', '/ops/', '/api/', '/auth/callback', '/auth/finish']

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: productDisallow,
      },
      ...AI_TRAINING_AND_RETRIEVAL_BOTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
