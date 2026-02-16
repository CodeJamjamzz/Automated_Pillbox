# --- Build Stage ---
# We use a Maven image that is based on Eclipse Temurin (stable Java 17)
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# --- Run Stage ---
# We use the Eclipse Temurin JRE (smaller and faster for running apps)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
# Copy the built JAR file from the previous stage
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]