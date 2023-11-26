FROM node:21.2-slim
WORKDIR /usr
COPY [".eslintrc.json", "package.json", "package-lock.json", "tsconfig.json", "./"]
COPY src ./src
RUN npm uninstall nodemon ts-node jest ts-jest @types/jest supertest @types/supertest eslint @typescript-eslint/eslint-plugin
RUN npm install --loglevel verbose
RUN npm run build:prod

# this is stage two , where the app actually runs
FROM node:21.2-slim
WORKDIR /usr
COPY package.json ./
RUN npm install --only=production --loglevel verbose
COPY --from=0 /usr/dist .
EXPOSE 5111

# Do not run as root
RUN addgroup --system localgroup
RUN adduser --system --ingroup localgroup localuser 
USER localuser

CMD ["node","index.js"]
