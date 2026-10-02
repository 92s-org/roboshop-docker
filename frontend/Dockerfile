# stage 1: build the React app into static files (dist/)
FROM node:24.21.0-alpine3.24 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# stage 2: serve them with nginx as a non-root user (uid 101)
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
