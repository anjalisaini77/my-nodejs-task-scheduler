# Use the official Node.js image from Docker Hub
FROM node:20

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose port 3000 (or your app's port)
EXPOSE 3000

# Command to run the app
CMD ["node", "server/index.js"]
