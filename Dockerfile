# syntax=docker/dockerfile:1
# check=error=true

#####################################################
# BASE STAGE
#####################################################
ARG RUBY_VERSION=3.4.4
FROM ruby:${RUBY_VERSION}-slim AS base

WORKDIR /rails

# OS dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    git \
    curl \
    libvips \
    libpq-dev \
    libyaml-dev \
    pkg-config \
    python3 \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Common ENV vars
ENV BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3

#####################################################
# BUILDER STAGE
#####################################################
FROM base AS build

# Install yarn and dependencies
RUN npm install -g yarn@1.22.22

# Copy dependencies first (for caching)
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/cache "${BUNDLE_PATH}"/ruby/*/cache

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy application source
COPY . .

# Precompile Rails bootsnap and assets
RUN bundle exec bootsnap precompile --gemfile app/ lib/ \
 && SECRET_KEY_BASE_DUMMY=1 RAILS_ENV=production bundle exec rails assets:precompile

#####################################################
# FINAL RUNTIME STAGE
#####################################################
FROM base

# Set default environment to production unless overridden
ENV RAILS_ENV="production" \
    RAILS_LOG_TO_STDOUT="true" \
    RAILS_SERVE_STATIC_FILES="true"

# Copy dependencies and app code
COPY --from=build ${BUNDLE_PATH} ${BUNDLE_PATH}
COPY --from=build /rails /rails

# Security: non-root user
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /rails
USER rails

# Entrypoint for Rails commands
ENTRYPOINT ["./bin/docker-entrypoint"]

# Default command (Puma server)
EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
