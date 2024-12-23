FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Install only the necessary libraries
RUN apt-get update && apt-get install -y \
    chromium-common \
    libasound2 \
    libgbm1 \
    libnss3 \
    sudo \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*