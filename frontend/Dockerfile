# (ตัวอย่างสำหรับ React / Vue / Angular ที่ Build แล้วรันผ่าน Nginx)

# FROM node:20-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# # Serve with Nginx
# FROM nginx:alpine
# COPY --from=builder /app/dist /usr/share/nginx/html
# # กรณีใช้ React Router ป้องกัน Refresh แล้วเจอ 404
# # COPY nginx.conf /etc/nginx/conf.d/default.conf
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]

# ใช้ Base Image ของ Nginx สำเร็จรูป (รัน Web Server เปล่าๆ ได้เลย)
FROM nginx:alpine

EXPOSE 80