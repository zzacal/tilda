# builds the application
FROM node:21.1-alpine as build
WORKDIR /usr
COPY [".eslintrc.json", "package.json", "package-lock.json", "tsconfig.json", "./"]
COPY src ./src
RUN npm ci
RUN npm run build:prod

# outputs the production app
FROM node:21.1-alpine as output
WORKDIR /usr
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npm install pm2 -g
COPY --from=build /usr/dist ./
EXPOSE 5111

# Do not run as root
RUN addgroup -S localgroup
RUN adduser -S localuser -G localgroup
USER localuser

CMD ["pm2-runtime","index.js"]
