FROM node:20-alpine

# Install FFmpeg with libx264 and SRT support
# The edge/community repos have a more complete FFmpeg build
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Verify FFmpeg has SRT support at build time
RUN ffmpeg -protocols 2>&1 | grep -q srt || (echo "FFmpeg missing SRT support" && exit 1)

EXPOSE 3000
CMD ["node", "dist/index.js"]
