FROM node:20-alpine

WORKDIR /app

# Copy package files first (better layer caching if you add deps later)
COPY package*.json ./
RUN npm install --omit=dev || true

# Copy app source
COPY app.js ./

# Run as non-root user (node image ships with user "node")
USER node

EXPOSE 3000

CMD ["node", "app.js"]
