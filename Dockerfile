FROM node:20-alpine

WORKDIR /app

# Copy server dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source and templates
COPY server/ ./
COPY templates/ ../templates/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]
