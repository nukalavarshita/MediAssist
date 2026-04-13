# Use Node
FROM node:18

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN cd backend && npm install

# Expose port
EXPOSE 3000

# Run app
CMD ["node", "backend/index.js"]
