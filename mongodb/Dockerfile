# MongoDB 7.0, not 8.0: the 8.0 image aborts at startup on some RHEL hosts
# (including the course EC2 AMI) with "Fatal assertion 40379 sha_block_openssl.cpp"
FROM mongo:7.0
# scripts here run once, only when the data volume is empty
COPY master-data.js /docker-entrypoint-initdb.d/
