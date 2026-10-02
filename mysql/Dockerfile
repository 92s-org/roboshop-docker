FROM mysql:8.4
# .sql files here run in name order, only when the data volume is empty:
# app-user.sql (shipping user) then master-data.sql (cities + codes)
COPY db/ /docker-entrypoint-initdb.d/
