FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Create the tables if they are missing, then start the site.
CMD ["sh", "-c", "node scripts/db-setup.js && npx next start -p 3000"]
