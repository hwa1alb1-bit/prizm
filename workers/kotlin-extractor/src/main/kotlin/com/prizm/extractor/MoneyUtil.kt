package com.prizm.extractor

import java.math.BigDecimal
import java.math.RoundingMode

internal fun money(value: Double): Double =
  BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).toDouble()

internal fun parseMoney(value: String): Double {
  val trimmed = value.trim()
  val negative = trimmed.contains("-") || (trimmed.startsWith("(") && trimmed.endsWith(")"))
  val digits = trimmed.replace(Regex("""[^0-9.]"""), "")
  val normalized = if (digits.startsWith(".")) "0$digits" else digits
  val amount = normalized.toDoubleOrNull() ?: 0.0
  return money(if (negative) -amount else amount)
}

internal fun collapse(text: String): String =
  text.replace(Regex("""\s+"""), " ").trim()
