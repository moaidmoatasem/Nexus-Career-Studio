FROM mcr.microsoft.com/playwright:v1.48.2-jammy
WORKDIR /worker
COPY package.json ./
RUN npm install --omit=dev
COPY *.mjs ./
CMD ["node", "index.mjs"]
