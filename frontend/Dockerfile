FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

EXPOSE 3003

CMD ["pnpm", "preview", "--port", "3003", "--host"]
