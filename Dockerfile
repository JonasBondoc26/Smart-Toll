# SmartToll on a server (Railway, or any Docker host): the Laravel API and the React website in one
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
ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr \
    CACHE_STORE=file SESSION_DRIVER=file QUEUE_CONNECTION=sync APP_TIMEZONE=Asia/Manila
EXPOSE 8080
CMD ["smarttoll-start"]
