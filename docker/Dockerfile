# This is a Dockerfile intended to be built using `docker buildx`
# for multi-arch support. Building with `docker build` may have unexpected results.
#
# This file assumes that the frontend has been built using ./scripts/frontend-build

ARG BASE_IMAGE=haproxy:3.0-alpine
FROM haproxy/testca AS testca
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
	NPM_BUILD_DATE="${BUILD_DATE}" \
	NODE_OPTIONS="--openssl-legacy-provider"

RUN apk add --no-cache \
	bash curl ca-certificates jq logrotate \
	&& echo "fs.file-max = 65535" > /etc/sysctl.conf

# s6 overlay
COPY docker/scripts/install-s6 /tmp/install-s6
RUN /tmp/install-s6 "${TARGETPLATFORM}" && rm -f /tmp/install-s6

EXPOSE 80 81 443

COPY backend       /app
COPY frontend/dist /app/frontend
COPY docker/rootfs /

# Copy test CA cert for use in container and add to trusted certs from a self-signed CA
COPY --from=testca /home/step/certs/root_ca.crt /etc/ssl/certs/HaproxyProxyManager.crt
WORKDIR /etc/ssl/certs
RUN ln -s HaproxyProxyManager.crt 1d0e3f10.0 && update-ca-certificates

WORKDIR /app
RUN apk add --no-cache nodejs npm yarn \
	&& yarn install \
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
