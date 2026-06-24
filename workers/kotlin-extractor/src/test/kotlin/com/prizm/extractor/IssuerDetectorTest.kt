package com.prizm.extractor

import kotlin.test.Test
import kotlin.test.assertEquals

class IssuerDetectorTest {
  @Test
  fun `detects Chase via domain or legal entity`() {
    val byDomain = IssuerDetector.detect("Visit us at chase.com for support.")
    assertEquals("Chase", byDomain.name)
    assertEquals(LayoutKey.CHASE, byDomain.layoutKey)

    val byLegal = IssuerDetector.detect("Issued by JPMorgan Chase Bank, N.A.")
    assertEquals("Chase", byLegal.name)
  }

  @Test
  fun `detects Bank of America via domain or legal entity`() {
    val byDomain = IssuerDetector.detect("bankofamerica.com")
    assertEquals("Bank of America", byDomain.name)
    assertEquals(LayoutKey.BANK_OF_AMERICA, byDomain.layoutKey)

    val byLegal = IssuerDetector.detect("Bank of America, N.A.")
    assertEquals("Bank of America", byLegal.name)
  }

  @Test
  fun `named-only fingerprints route to GENERIC layout but preserve issuer name`() {
    val wellsFargo = IssuerDetector.detect("Customer service: wellsfargo.com")
    assertEquals("Wells Fargo", wellsFargo.name)
    assertEquals(LayoutKey.GENERIC, wellsFargo.layoutKey)

    val usaa = IssuerDetector.detect("USAA Federal Savings Bank")
    assertEquals("USAA", usaa.name)
    assertEquals(LayoutKey.GENERIC, usaa.layoutKey)

    val capitalOne = IssuerDetector.detect("Capital One Bank (USA), N.A.")
    assertEquals("Capital One", capitalOne.name)

    val citi = IssuerDetector.detect("Citibank, N.A.")
    assertEquals("Citi", citi.name)

    val usBank = IssuerDetector.detect("U.S. Bank National Association")
    assertEquals("US Bank", usBank.name)

    val pnc = IssuerDetector.detect("PNC Bank, N.A.")
    assertEquals("PNC", pnc.name)

    val discover = IssuerDetector.detect("Discover Bank")
    assertEquals("Discover", discover.name)

    val amex = IssuerDetector.detect("americanexpress.com")
    assertEquals("American Express", amex.name)
  }

  @Test
  fun `unknown PDF returns the Unknown issuer profile with GENERIC layout`() {
    val unknown = IssuerDetector.detect("Some Tiny Credit Union, anywhere USA")
    assertEquals("Unknown issuer", unknown.name)
    assertEquals(LayoutKey.GENERIC, unknown.layoutKey)
  }

  @Test
  fun `precision issuer wins over a more permissive name match`() {
    // A Chase PDF that happens to mention "American Express" in a transaction description
    // must still route to Chase's precision layout, not get hijacked by the AMEX fingerprint.
    val text = """
      |chase.com
      |04/03 AMEX MEMBERSHIP REWARDS 50.00
    """.trimMargin()
    val issuer = IssuerDetector.detect(text)
    assertEquals("Chase", issuer.name)
    assertEquals(LayoutKey.CHASE, issuer.layoutKey)
  }
}
