# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend
WORKDIR /source/my-react
COPY my-react/ ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund && npm run build && npm run check:bundle

FROM eclipse-temurin:25-jdk AS build
WORKDIR /source/backend
COPY backend/ ./
RUN --mount=type=bind,from=frontend,source=/source/my-react/dist,target=/frontend-dist \
    --mount=type=cache,target=/root/.m2 \
    --mount=type=secret,id=maven_settings \
    --mount=type=secret,id=proxy_ca \
    set -eu; apt-get update; apt-get install -y --no-install-recommends curl; rm -rf /var/lib/apt/lists/*; \
    sed -i 's/\r$//' mvnw; chmod +x mvnw; \
    if [ -f /run/secrets/proxy_ca ]; then \
      cp "$JAVA_HOME/lib/security/cacerts" /tmp/build-cacerts; \
      keytool -importcert -noprompt -alias build-proxy -file /run/secrets/proxy_ca -keystore /tmp/build-cacerts -storepass changeit; \
      export MAVEN_OPTS="-Djavax.net.ssl.trustStore=/tmp/build-cacerts"; \
      export CURL_CA_BUNDLE=/run/secrets/proxy_ca; \
    fi; \
    if [ -f /run/secrets/maven_settings ]; then set -- -s /run/secrets/maven_settings; else set --; fi; \
    ./mvnw -B -ntp "$@" clean package -Pwith-frontend -Dfrontend.outputDirectory=/frontend-dist -DskipTests; \
    rm -f /tmp/build-cacerts

FROM eclipse-temurin:25-jre AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /source/backend/target/backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
