# Use an official Node.js runtime as the base image
FROM node:21.1.0-slim

# Set the working directory in the container to /app
WORKDIR /app

# Copy the application code into the container
COPY . .

# Install the application dependencies
RUN npm install

# Build the application
RUN npm run build

# Expose port 3000 for the application
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]