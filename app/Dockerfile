# Grupo: Caio Abreu, Cassiano Abreu, Enzo Aquino, Gabriel Naoki e Wyllian Mariano
# Imagem da aplicação de tarefas
FROM node:20-alpine

WORKDIR /usr/src/app

# Instala as dependências primeiro (aproveita o cache do Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o código da aplicação
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
