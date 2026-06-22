package com.prizm.extractor

import org.slf4j.LoggerFactory
import org.slf4j.MDC

/**
 * Per-stage structured logging. Each stage emits one JSON line with jobId, stage, durationMs,
 * outcome. The Cloudflare Container forwards stdout to PRIZM's log aggregator.
 *
 * SLF4J + Logback are configured to produce JSON via Logstash encoder (see logback.xml).
 */
class ExtractionLogger private constructor() {
  private val logger = LoggerFactory.getLogger("prizm.extractor")

  fun <T> runJob(jobId: String, block: StageContext.() -> T): T {
    MDC.put(MDC_JOB_ID, jobId)
    return try {
      StageContext(logger, jobId).block()
    } finally {
      MDC.remove(MDC_JOB_ID)
    }
  }

  companion object {
    private const val MDC_JOB_ID = "jobId"

    fun default(): ExtractionLogger = ExtractionLogger()
  }
}

class StageContext internal constructor(
  private val logger: org.slf4j.Logger,
  val jobId: String,
) {
  fun <T> stage(name: String, block: () -> T): T {
    val started = System.nanoTime()
    return try {
      val result = block()
      val durationMs = elapsedMs(started)
      logger.info(stageMessage(name, "ok", durationMs))
      result
    } catch (error: Throwable) {
      val durationMs = elapsedMs(started)
      logger.warn(stageMessage(name, "error", durationMs) + " errorClass=" + (error::class.simpleName ?: "?"))
      throw error
    }
  }

  fun stageOutcome(name: String, outcomeLabel: String, durationMs: Long) {
    logger.info(stageMessage(name, outcomeLabel, durationMs))
  }

  private fun stageMessage(stage: String, outcome: String, durationMs: Long): String =
    "extractor.stage stage=$stage outcome=$outcome durationMs=$durationMs"

  private fun elapsedMs(startedNanos: Long): Long =
    (System.nanoTime() - startedNanos) / 1_000_000L
}
