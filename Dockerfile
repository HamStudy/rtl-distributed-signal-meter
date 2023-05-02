FROM node:18 as base

ENV NODE_ENV=production

WORKDIR /app
COPY package.json /app/
COPY .npmrc /app/

RUN npm install --omit=dev

FROM base as dev

ENV NODE_ENV=development

RUN npm install --only=development

COPY . /app

RUN npm run build

FROM base as final

COPY --from=dev /app/dist /app/dist
COPY --from=dev /app/ndist /app/ndist
COPY --from=dev /app/views /app/ndist

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"

CMD ["node", "ndist/www"]

