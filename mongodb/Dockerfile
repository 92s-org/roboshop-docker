FROM mongo:8.0
# scripts here run once, only when the data volume is empty
COPY master-data.js /docker-entrypoint-initdb.d/
