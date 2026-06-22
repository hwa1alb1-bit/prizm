package com.prizm.extractor

import java.nio.file.Files
import java.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withContext

/**
 * In-container batch fan-out. The Cloudflare Worker collects a Cloudflare Queue batch (up to
 * `max_batch_size` messages) and posts the bundle to `/internal/extract-batch` as one HTTP
 * request. This handler runs each job concurrently inside a [supervisorScope], so a malformed
 * PDF, a decode error, or an extraction failure on any one job never aborts the sibling jobs.
 *
 * Dispatcher specialization: temp-file write + base64 decode runs on [Dispatchers.IO]; PDFBox
 * load + parse runs on [Dispatchers.Default]. The base64-encoded PDF payload format is the
 * simplest path that fits Cloudflare Containers: bandwidth inflation (~33%) is internal
 * Worker -> Container traffic on the Cloudflare network, not customer-facing bytes.
 *
 * Wire contract preserved: each per-job result is the same [WorkerPollResponse] shape the
 * single-PDF endpoint returns. The batch wrapper is purely an envelope.
 */
class BatchExtractionHandler(
  private val extractor: PdfStatementExtractor = PdfStatementExtractor(),
) {
  suspend fun handle(request: BatchExtractionRequest): BatchExtractionResponse {
    val results = supervisorScope {
      request.jobs.map { job ->
        async(Dispatchers.IO) { extractOne(job) }
      }.awaitAll()
    }
    return BatchExtractionResponse(results)
  }

  private suspend fun extractOne(job: BatchJob): WorkerPollResponse =
    try {
      val tempFile = withContext(Dispatchers.IO) {
        val path = Files.createTempFile("prizm-batch-", ".pdf")
        val bytes = Base64.getDecoder().decode(job.pdfBase64)
        Files.write(path, bytes)
        path
      }
      try {
        withContext(Dispatchers.Default) {
          extractor.extract(tempFile, job.jobId)
        }
      } finally {
        withContext(Dispatchers.IO) {
          runCatching { Files.deleteIfExists(tempFile) }
        }
      }
    } catch (error: Exception) {
      ExtractionOutcome.UnexpectedFailure(error.message ?: "Batch extraction failed.")
        .toWorkerPollResponse(job.jobId)
    }
}

data class BatchExtractionRequest(val jobs: List<BatchJob> = emptyList())

data class BatchJob(val jobId: String = "", val pdfBase64: String = "")

data class BatchExtractionResponse(val results: List<WorkerPollResponse>)
