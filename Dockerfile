FROM mcr.microsoft.com/playwright:v1.46.0-jammy

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --only=production || npm ci --omit=dev

COPY dist ./dist
COPY .env.example .

USER pwuser

EXPOSE 7801

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||7801)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1

ENTRYPOINT ["/bin/bash", "-lc"]
CMD ["node", "dist/server.js"]



