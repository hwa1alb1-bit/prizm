package com.prizm.extractor

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

fun main(args: Array<String>) {
  val service = ExtractorHttpService().start(port = servicePort(args))
  println("PRIZM Kotlin extractor HTTP service listening on ${service.uri}")
  Runtime.getRuntime().addShutdownHook(Thread { service.close() })
  Thread.currentThread().join()
}

class ExtractorHttpService(
  private val extractor: PdfStatementExtractor = PdfStatementExtractor(),
  private val mapper: ObjectMapper = jacksonObjectMapper()
    .setSerializationInclusion(JsonInclude.Include.NON_NULL),
) {
  fun start(port: Int): RunningExtractorHttpService {
    val executor = Executors.newFixedThreadPool(4)
    val server = HttpServer.create(InetSocketAddress("0.0.0.0", port), 0)
    server.createContext("/internal/extract") { exchange ->
      handleExtract(exchange)
    }
    server.executor = executor
    server.start()
    return RunningExtractorHttpService(server, executor)
  }

  private fun handleExtract(exchange: HttpExchange) {
    try {
      if (exchange.requestURI.path != "/internal/extract") {
        sendJson(
          exchange,
          statusCode = 404,
          WorkerPollResponse(
            status = "failed",
            failureReason = "Endpoint not found.",
          ),
        )
        return
      }

      if (!exchange.requestMethod.equals("POST", ignoreCase = true)) {
        exchange.responseHeaders.set("Allow", "POST")
        sendJson(
          exchange,
          statusCode = 405,
          WorkerPollResponse(
            status = "failed",
            failureReason = "Method not allowed.",
          ),
        )
        return
      }

      val jobId = requestJobId(exchange)
      val uploadedPdf = Files.createTempFile("prizm-extractor-", ".pdf")
      try {
        exchange.requestBody.use { requestBody ->
          Files.copy(requestBody, uploadedPdf, StandardCopyOption.REPLACE_EXISTING)
        }
        sendJson(
          exchange,
          statusCode = 200,
          tryExtract(uploadedPdf, jobId),
        )
      } finally {
        runCatching { Files.deleteIfExists(uploadedPdf) }
      }
    } catch (error: Exception) {
      sendJson(
        exchange,
        statusCode = 500,
        WorkerPollResponse(
          status = "failed",
          failureReason = error.message ?: "Kotlin worker extraction failed.",
        ),
      )
    } finally {
      exchange.close()
    }
  }

  private fun tryExtract(uploadedPdf: java.nio.file.Path, jobId: String): WorkerPollResponse =
    try {
      extractor.extract(uploadedPdf, jobId)
    } catch (error: Exception) {
      WorkerPollResponse(
        status = "failed",
        jobId = jobId,
        failureReason = error.message ?: "Kotlin worker extraction failed.",
      )
    }

  private fun requestJobId(exchange: HttpExchange): String =
    queryParam(exchange.requestURI, "jobId")
      ?: exchange.requestHeaders.getFirst("X-PRIZM-Job-Id")?.takeIf { it.isNotBlank() }
      ?: "http-${UUID.randomUUID()}"

  private fun sendJson(
    exchange: HttpExchange,
    statusCode: Int,
    response: WorkerPollResponse,
  ) {
    val body = mapper.writeValueAsBytes(response)
    exchange.responseHeaders.set("Content-Type", "application/json; charset=utf-8")
    exchange.responseHeaders.set("Cache-Control", "no-store")
    exchange.sendResponseHeaders(statusCode, body.size.toLong())
    exchange.responseBody.use { responseBody ->
      responseBody.write(body)
    }
  }
}

class RunningExtractorHttpService internal constructor(
  private val server: HttpServer,
  private val executor: ExecutorService,
) : AutoCloseable {
  val uri: URI = URI.create("http://127.0.0.1:${server.address.port}")

  override fun close() {
    server.stop(0)
    executor.shutdownNow()
  }
}

private fun servicePort(args: Array<String>): Int =
  option(args, "--port")?.toIntOrNull()
    ?: System.getenv("PORT")?.toIntOrNull()
    ?: 8080

private fun option(args: Array<String>, name: String): String? {
  val index = args.indexOf(name)
  if (index < 0 || index + 1 >= args.size) return null
  return args[index + 1]
}

private fun queryParam(uri: URI, name: String): String? =
  uri.rawQuery
    ?.split("&")
    ?.asSequence()
    ?.mapNotNull { part ->
      val pieces = part.split("=", limit = 2)
      val key = urlDecode(pieces[0])
      if (key == name) urlDecode(pieces.getOrElse(1) { "" }) else null
    }
    ?.firstOrNull { it.isNotBlank() }

private fun urlDecode(value: String): String =
  URLDecoder.decode(value, StandardCharsets.UTF_8)
