FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY fixtures ./fixtures
RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["node", "src/cli.js", "live"]
