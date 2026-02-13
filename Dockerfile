# Use Node.js 20 on Debian Bullseye
FROM node:20-bullseye

# Install LibreOffice and Java (required for LibreOffice)
RUN apt-get update && \
    apt-get install -y libreoffice default-jre && \
    rm -rf /var/lib/apt/lists/*

# Set LibreOffice path environment variable
ENV LIBREOFFICE_PATH=/usr/bin/libreoffice

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies including devDependencies (needed for build)
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port
EXPOSE 5002

# Start the server
CMD [ "npm", "start" ]
