# This is a Dockerfile intended to be built using docker buildx
# for multi-arch support. Building with docker build may have unexpected results.
#
# This file assumes that the frontend has been built using ./scripts/frontend-build

ARG BASE_IMAGE=node:20-alpine
FROM $BASE_IMAGE

ARG TARGETPLATFORM
ARG BUILD_VERSION
ARG BUILD_COMMIT
ARG BUILD_DATE

# See: https://github.com/just-containers/s6-overlay/blob/master/README.md
ENV SUPPRESS_NO_CONFIG_WARNING=1 \
	S6_BEHAVIOUR_IF_STAGE2_FAILS=1 \
	S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
	S6_FIX_ATTRS_HIDDEN=1 \
	S6_KILL_FINISH_MAXTIME=10000 \
	S6_VERBOSITY=1 \
	NODE_ENV=production \
	NPM_BUILD_VERSION="${BUILD_VERSION}" \
	NPM_BUILD_COMMIT="${BUILD_COMMIT}" \
	NPM_BUILD_DATE="${BUILD_DATE}"

RUN apk add --no-cache \
	bash curl ca-certificates jq logrotate python3 make g++ openssl haproxy shadow \
	&& echo "fs.file-max = 65535" > /etc/sysctl.conf

# Create HAProxy default error pages (required for errorfile directives)
RUN mkdir -p /etc/haproxy/errors && \
	printf "HTTP/1.0 400 Bad Request\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n400 Bad Request" > /etc/haproxy/errors/400.http && \
	printf "HTTP/1.0 403 Forbidden\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n403 Forbidden" > /etc/haproxy/errors/403.http && \
	printf "HTTP/1.0 408 Request Timeout\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n408 Request Timeout" > /etc/haproxy/errors/408.http && \
	printf "HTTP/1.0 500 Internal Server Error\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n500 Internal Server Error" > /etc/haproxy/errors/500.http && \
	printf "HTTP/1.0 502 Bad Gateway\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n502 Bad Gateway" > /etc/haproxy/errors/502.http && \
	printf "HTTP/1.0 503 Service Unavailable\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n503 Service Unavailable" > /etc/haproxy/errors/503.http && \
	printf "HTTP/1.0 504 Gateway Timeout\nCache-Control: no-cache\nConnection: close\nContent-Type: text/html\n\n504 Gateway Timeout" > /etc/haproxy/errors/504.http

# Install certbot for Let's Encrypt integration
RUN apk add --no-cache certbot

# s6 overlay
COPY docker/scripts/install-s6 /tmp/install-s6
RUN /tmp/install-s6 "${TARGETPLATFORM}" && rm -f /tmp/install-s6

EXPOSE 80 81 443

COPY backend       /app
COPY frontend/dist /app/frontend
COPY docker/rootfs /

# Create a self-signed test CA cert for development (was from haproxy/testca)
RUN openssl req -x509 -newkey rsa:4096 -keyout /tmp/privkey.pem -out /tmp/cert.pem \
	-days 365 -nodes -subj "/CN=HaproxyProxyManager Test CA" 2>/dev/null \
	&& cat /tmp/cert.pem /tmp/privkey.pem > /etc/ssl/certs/HaproxyProxyManager.crt \
	&& rm /tmp/privkey.pem /tmp/cert.pem \
	&& ln -s /etc/ssl/certs/HaproxyProxyManager.crt /etc/ssl/certs/1d0e3f10.0 \
	&& update-ca-certificates

WORKDIR /app
RUN yarn install \
	&& yarn cache clean

# Remove frontend service not required for prod, dev config as well
RUN rm -rf /etc/s6-overlay/s6-rc.d/user/contents.d/frontend /etc/haproxy/conf.d/dev.conf \
	&& chmod 644 /etc/logrotate.d/haproxy-proxy-manager

VOLUME [ "/data" ]
ENTRYPOINT [ "/init" ]

LABEL org.label-schema.schema-version="1.0" \
	org.label-schema.license="MIT" \
	org.label-schema.name="haproxy-proxy-manager" \
	org.label-schema.description="Docker container for managing HAProxy proxy hosts with a simple, powerful interface " \
	org.label-schema.url="https://github.com/eduardofbrito/haproxy-proxy-manager" \
	org.label-schema.vcs-url="https://github.com/eduardofbrito/haproxy-proxy-manager.git" \
	org.label-schema.cmd="docker run --rm -ti eduardofbrito/haproxy-proxy-manager:latest"
