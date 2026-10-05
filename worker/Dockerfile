FROM mcr.microsoft.com/playwright:v1.48.2-jammy
WORKDIR /worker
COPY package.json ./
RUN npm install --omit=dev
COPY *.mjs ./
# Run as the image's unprivileged user rather than root: the helper opens third-party pages.
USER pwuser
CMD ["node", "index.mjs"]
