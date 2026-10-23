FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .

ENV NODE_ENV=production
RUN npx prisma generate

EXPOSE 3500

CMD ["npm", "start"]
