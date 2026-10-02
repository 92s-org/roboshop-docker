# troubleshooting container: docker compose --profile debug run --rm debug
FROM almalinux:9
RUN dnf install -y telnet iputils bind-utils nmap-ncat procps-ng mysql \
    && dnf clean all
CMD ["sleep", "infinity"]
