FROM haproxy/testca AS testca
FROM haproxy:3.0-alpine
LABEL maintainer="Jamie Curnow <jc@jc21.com>"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV SUPPRESS_NO_CONFIG_WARNING=1 \
	S6_BEHAVIOUR_IF_STAGE2_FAILS=1 \
	S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
	S6_FIX_ATTRS_HIDDEN=1 \
	S6_KILL_FINISH_MAXTIME=10000 \
	S6_VERBOSITY=2 \
	NODE_OPTIONS="--openssl-legacy-provider"

RUN apk add --no-cache jq python3 logrotate moreutils ca-certificates \
	&& echo "fs.file-max = 65535" > /etc/sysctl.conf

# Task
WORKDIR /usr
RUN curl -sL 'https://taskfile.dev/install.sh' | sh

COPY rootfs /

COPY scripts/install-s6 /tmp/install-s6
RUN rm -f /etc/haproxy/conf.d/production.conf.template \
	&& chmod 644 /etc/logrotate.d/haproxy-proxy-manager \
	&& /tmp/install-s6 "${TARGETPLATFORM}" \
	&& rm -f /tmp/install-s6 \
	&& chmod 644 -R /root/.cache

# Copy test CA cert for use in container and add to trusted certs from a self-signed CA
COPY --from=testca /home/step/certs/root_ca.crt /etc/ssl/certs/HaproxyProxyManager.crt
WORKDIR /etc/ssl/certs
RUN ln -s HaproxyProxyManager.crt 1d0e3f10.0 && update-ca-certificates

WORKDIR /root

EXPOSE 80 81 443
ENTRYPOINT [ "/init" ]
