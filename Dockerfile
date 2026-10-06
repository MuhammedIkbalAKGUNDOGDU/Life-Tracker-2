# --- 1) Build the React client ---
FROM node:22-alpine AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- 2) Runtime: Express serves API + built client ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js auth.js ./
COPY --from=client-build /client/dist ./client/dist
USER node
EXPOSE 3000
CMD ["node", "server.js"]
