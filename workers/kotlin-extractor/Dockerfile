# syntax=docker/dockerfile:1

FROM gradle:8.14-jdk21 AS build
WORKDIR /workspace
COPY . .
RUN chmod +x ./gradlew && ./gradlew --no-daemon installDist

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/build/install/prizm-kotlin-extractor/lib ./lib
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-cp", "/app/lib/*", "com.prizm.extractor.ExtractorHttpServiceKt"]
