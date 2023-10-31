FROM node:lts-alpine
WORKDIR /usr
COPY [".eslintrc.json", "package.json", "package-lock.json", "tsconfig.json", "./"]
COPY src ./src
RUN npm install
RUN npm run build:prod

# this is stage two , where the app actually runs
FROM node:lts-alpine
WORKDIR /usr
COPY package.json ./
RUN npm install --only=production
COPY --from=0 /usr/dist .
RUN npm install pm2 -g
EXPOSE 5111

# Do not run as root
RUN addgroup -S localgroup
RUN adduser -S localuser -G localgroup
USER localuser

CMD ["pm2-runtime","index.js"]
