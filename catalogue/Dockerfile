FROM node:24.21.0-alpine3.24 AS builder
WORKDIR /app
COPY package*.json ./
# npm ci installs the exact versions from package-lock.json
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24.21.0-alpine3.24
ENV NODE_ENV=production \
    MONGO_URL="mongodb://mongodb:27017/catalogue"
WORKDIR /app
RUN addgroup -S roboshop && adduser -S -G roboshop roboshop
COPY --from=builder --chown=roboshop:roboshop /app/node_modules ./node_modules
COPY --chown=roboshop:roboshop package.json server.js ./
USER roboshop
EXPOSE 8080
CMD ["node", "server.js"]
