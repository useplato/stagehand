# Use Node.js LTS (Long Term Support) image as base
FROM --platform=linux/amd64 node:20-slim

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your server will run on (adjust if needed)
EXPOSE 3000

# Start the server
CMD npm run build-dom-scripts && npm run build-js && npm run build-types && \
	npx tsx evals/eval_api_server.ts
