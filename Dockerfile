# SmartToll on a server (Render, Railway, or any Docker host): the Laravel API and the React website in one
# container, served by FrankenPHP (a production PHP server). See README → Put SmartToll online.

# 1. Build the React website
FROM node:22-alpine AS website
WORKDIR /website
COPY smarttoll/frontend/package.json smarttoll/frontend/package-lock.json ./
RUN npm ci
COPY smarttoll/frontend/ ./
RUN npm run build

# 2. The API, with the website's files in its public folder
FROM dunglas/frankenphp:1-php8.3-bookworm
RUN install-php-extensions pdo_mysql zip opcache intl
# The image gives frankenphp a file capability (to open ports 80/443). Hosts that forbid extra
# privileges, such as Render's free plan, then refuse to run it ("Operation not permitted").
# SmartToll listens on the host's $PORT (above 1024), so a plain copy without it is enough.
RUN (setcap -r /usr/local/bin/frankenphp 2>/dev/null || true) \
 && cp /usr/local/bin/frankenphp /tmp/frankenphp && mv -f /tmp/frankenphp /usr/local/bin/frankenphp \
 && chmod 755 /usr/local/bin/frankenphp
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app

COPY smarttoll-api/composer.json smarttoll-api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist
COPY smarttoll-api/ ./
RUN composer dump-autoload --optimize --no-dev \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chmod -R ug+rwX storage bootstrap/cache

# The website: its page becomes public/spa.html (served by Laravel for every non-API path),
# its scripts, styles and icons go next to Laravel's index.php.
COPY --from=website /website/dist/ /tmp/website/
RUN mv /tmp/website/index.html public/spa.html && cp -r /tmp/website/. public/ && rm -rf /tmp/website

COPY docker/start.sh /usr/local/bin/smarttoll-start
RUN chmod +x /usr/local/bin/smarttoll-start
# Production defaults (override any of them in the host's variables). Cache and sessions in
# files and jobs run immediately, so no extra database tables are needed.
# DB_CONNECTION: Laravel's own default is SQLite; SmartToll uses MySQL (address in DB_URL).
ENV APP_NAME=SmartToll APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr DB_CONNECTION=mysql \
    CACHE_STORE=file SESSION_DRIVER=file QUEUE_CONNECTION=sync APP_TIMEZONE=Asia/Manila
EXPOSE 8080
CMD ["smarttoll-start"]
