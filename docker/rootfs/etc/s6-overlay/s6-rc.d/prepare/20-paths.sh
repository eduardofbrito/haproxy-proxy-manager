#!/command/with-contenv bash
# shellcheck shell=bash

set -e

log_info 'Checking paths ...'

# Ensure /data is mounted
if [ ! -d '/data' ]; then
	log_fatal '/data is not mounted! Check your docker configuration.'
fi
# Ensure /etc/letsencrypt is mounted
if [ ! -d '/etc/letsencrypt' ]; then
	log_fatal '/etc/letsencrypt is not mounted! Check your docker configuration.'
fi

# Create required folders
mkdir -p \
	/data/haproxy \
	/data/custom_ssl \
	/data/logs \
	/data/access \
	/data/haproxy/default_host \
	/data/haproxy/default_www \
	/data/haproxy/proxy_host \
	/data/haproxy/redirection_host \
	/data/haproxy/stream \
	/data/haproxy/dead_host \
	/data/haproxy/temp \
	/data/letsencrypt-acme-challenge \
	/run/haproxy \
	/etc/haproxy/errors

touch /var/log/haproxy/error.log || true
chmod 644 /etc/logrotate.d/haproxy-proxy-manager
