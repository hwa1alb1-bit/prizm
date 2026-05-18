package com.prizm.extractor

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Path
import kotlin.io.path.div
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.font.PDType1Font
import org.apache.pdfbox.pdmodel.font.Standard14Fonts
import org.junit.jupiter.api.io.TempDir

class ExtractorHttpServiceTest {
  private val mapper = jacksonObjectMapper()

  @Test
  fun `posts selectable text PDF to internal extract endpoint and returns worker poll JSON`(
    @TempDir tempDir: Path,
  ) {
    val fixture = tempDir / "generated-chase-statement.pdf"
    writeTextPdf(
      fixture,
      listOf(
        "chase.com",
        "Account Number 1111 2222 3333 4242",
        "Opening/Closing Date 04/01/26 - 04/30/26",
        "Payment Due Date: 05/25/26",
        "Minimum Payment Due: \$35.00",
        "Previous Balance \$1,000.00",
        "New Balance: \$1,050.00",
        "Payment, Credits -\$200.00",
        "Purchases \$250.00",
        "Fees Charged \$0.00",
        "Interest Charged \$0.00",
        "Transaction Description $ Amount",
        "04/03 Coffee Shop 50.00",
        "04/18 Payment Thank You -200.00",
        "04/22 AMAZON MKTPL 200.00",
        "Total fees charged",
      ),
    )

    ExtractorHttpService().start(port = 0).use { service ->
      val response = HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(service.uri.resolve("/internal/extract?jobId=http-job-1"))
          .header("Content-Type", "application/pdf")
          .POST(HttpRequest.BodyPublishers.ofFile(fixture))
          .build(),
        HttpResponse.BodyHandlers.ofString(),
      )

      assertEquals(200, response.statusCode())
      val json = mapper.readTree(response.body())
      assertEquals("succeeded", json["status"].asText())
      assertEquals("http-job-1", json["jobId"].asText())
      assertEquals("Chase", json["statements"][0]["bankName"].asText())
      assertEquals(3, json["statements"][0]["transactions"].size())
    }
  }

  @Test
  fun `posts blank PDF to internal extract endpoint and returns failed worker poll JSON`(
    @TempDir tempDir: Path,
  ) {
    val blankPdf = tempDir / "blank.pdf"
    PDDocument().use { document ->
      document.addPage(PDPage())
      document.save(blankPdf.toFile())
    }

    ExtractorHttpService().start(port = 0).use { service ->
      val response = HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(service.uri.resolve("/internal/extract"))
          .header("Content-Type", "application/pdf")
          .header("X-PRIZM-Job-Id", "http-job-blank")
          .POST(HttpRequest.BodyPublishers.ofFile(blankPdf))
          .build(),
        HttpResponse.BodyHandlers.ofString(),
      )

      assertEquals(200, response.statusCode())
      val json = mapper.readTree(response.body())
      assertEquals("failed", json["status"].asText())
      assertEquals("http-job-blank", json["jobId"].asText())
      assertEquals(0, json["statements"].size())
      assertTrue(json["failureReason"].asText().contains("Selectable text was not found"))
    }
  }

  private fun writeTextPdf(path: Path, lines: List<String>) {
    PDDocument().use { document ->
      val page = PDPage()
      document.addPage(page)
      PDPageContentStream(document, page).use { content ->
        content.beginText()
        content.setFont(PDType1Font(Standard14Fonts.FontName.HELVETICA), 10f)
        content.setLeading(14f)
        content.newLineAtOffset(48f, 740f)
        lines.forEach { line ->
          content.showText(line)
          content.newLine()
        }
        content.endText()
      }
      document.save(path.toFile())
    }
  }
}
