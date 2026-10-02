FROM maven:3.9.16-eclipse-temurin-25-alpine AS builder
WORKDIR /app
# download dependencies first, this layer is cached until pom.xml changes
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q clean package -DskipTests

# Java is portable: the jar built above runs on any JRE of the same version
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
RUN addgroup -S roboshop && adduser -S -G roboshop roboshop
COPY --from=builder --chown=roboshop:roboshop /app/target/shipping.jar .
USER roboshop
EXPOSE 8080
# size the heap from the container memory limit
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
CMD ["java", "-jar", "shipping.jar"]
