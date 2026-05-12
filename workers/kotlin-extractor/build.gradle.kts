plugins {
  kotlin("jvm") version "2.1.21"
  application
}

group = "com.prizm"
version = "0.1.0"

kotlin {
  jvmToolchain(21)
}

application {
  mainClass.set("com.prizm.extractor.ExtractorCliKt")
}

dependencies {
  implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.19.0")
  implementation("org.apache.pdfbox:pdfbox:3.0.4")

  testImplementation(kotlin("test"))
  testImplementation("org.junit.jupiter:junit-jupiter-params:5.12.2")
}

tasks.test {
  useJUnitPlatform()
}
