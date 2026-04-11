FROM node:20

WORKDIR /app

# copy dependency files first
COPY package*.json ./

# install dependencies with lower memory usage
RUN npm install --no-audit --no-fund

# copy project files
COPY . .

# generate prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 8008

CMD ["node", "src/server.js"]