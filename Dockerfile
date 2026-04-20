FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements_for_sandbox.txt .

RUN python -m pip install --upgrade pip
RUN python -m pip install --no-cache-dir -r requirements_for_sandbox.txt

WORKDIR /sandbox

RUN mkdir -p /sandbox/output

CMD ["sleep", "infinity"]