FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de camada).
COPY package.json ./
RUN npm install --omit=dev

# Copia os scripts e gera a base de dados na imagem.
COPY generate-db.js server.js ./
RUN node generate-db.js

EXPOSE 3000
CMD ["node", "server.js"]
