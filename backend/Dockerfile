# (ตัวอย่างกรณีใช้ Java Spring Boot)

# FROM maven:3.9-eclipse-temurin-17 AS builder
# WORKDIR /app
# COPY pom.xml .
# RUN mvn dependency:go-offline
# COPY src ./src
# RUN mvn package -DskipTests

# # Run Application
# FROM eclipse-temurin:17-jre-alpine
# WORKDIR /app
# COPY --from=builder /app/target/*.jar app.jar
# EXPOSE 8080
# ENTRYPOINT ["java", "-jar", "app.jar"]

# ใช้ Base Image ของ Java สำเร็จรูป
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

EXPOSE 8080

# คำสั่งสั่งให้ Container รันค้างไว้ ไม่ให้เด้งดับ
CMD ["tail", "-f", "/dev/null"]