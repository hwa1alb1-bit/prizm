import { Container } from '@cloudflare/containers'
import {
  handleCloudflareExtractorQueue,
  handleCloudflareExtractorRequest,
  type CloudflareExtractorEnv,
  type ExtractionJobMessage,
  type QueueBatchLike,
} from './handlers'

export { handleCloudflareExtractorQueue, handleCloudflareExtractorRequest }
export type { CloudflareExtractorEnv, ExtractionJobMessage }

export class KotlinExtractorContainer extends Container<CloudflareExtractorEnv> {
  defaultPort = 8080
  sleepAfter = '2m'
  envVars = {
    PORT: '8080',
  }
}

const cloudflareExtractorWorker = {
  async fetch(request: Request, env: CloudflareExtractorEnv): Promise<Response> {
    return handleCloudflareExtractorRequest(request, env)
  },
  async queue(
    batch: QueueBatchLike<ExtractionJobMessage>,
    env: CloudflareExtractorEnv,
  ): Promise<void> {
    await handleCloudflareExtractorQueue(batch, env)
  },
}

export default cloudflareExtractorWorker
