FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    wget \
    gnupg \
    lsb-release \
    fuse3 \
    libfuse3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y s3fs && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

RUN mkdir -p /workspace/files /tmp/blobfuse2-cache /root/.azure && \
    chmod 777 /workspace/files /tmp/blobfuse2-cache && \
    chmod 700 /root/.azure

# Note: Azure CLI credentials will be copied from host at runtime
# For Azure CLI auth (mode=cli), run 'az login' on your host before starting sandbox
# The backend will copy ~/.azure directory into the sandbox

RUN echo '#!/bin/bash\nexec /bin/bash "$@"' > /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["-l"]
