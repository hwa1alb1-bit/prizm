package com.prizm.extractor

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.io.PrintStream
import java.nio.file.Path
import kotlin.system.exitProcess

fun main(args: Array<String>) {
  exitProcess(ExtractorCli().run(args, System.out, System.err))
}

class ExtractorCli {
  private val mapper = jacksonObjectMapper()
    .setSerializationInclusion(JsonInclude.Include.NON_NULL)

  fun run(args: Array<String>, out: PrintStream, err: PrintStream): Int {
    val input = inputPath(args)
    if (input == null) {
      err.println("Usage: kotlin-extractor --input <statement.pdf> [--job-id <job-id>]")
      return 2
    }

    val jobId = option(args, "--job-id") ?: "local-${input.fileName}"
    val response = try {
      PdfStatementExtractor().extract(input, jobId)
    } catch (error: Exception) {
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = error.message ?: "Kotlin worker extraction failed.",
      )
    }

    out.println(mapper.writeValueAsString(response))
    return if (response.status == "succeeded") 0 else 1
  }

  private fun inputPath(args: Array<String>): Path? =
    option(args, "--input")?.let(Path::of)

  private fun option(args: Array<String>, name: String): String? {
    val index = args.indexOf(name)
    if (index < 0 || index + 1 >= args.size) return null
    return args[index + 1]
  }
}
