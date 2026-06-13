#!/command/with-contenv bash
# shellcheck shell=bash

set -e

log_info 'Setting ownership ...'

chown root /tmp/npm

locations=(
	"/data"
	"/etc/letsencrypt"
	"/run/haproxy"
	"/tmp/npm"
	"/etc/haproxy"
	"/var/log/haproxy"
	"/etc/logrotate.d"
)

chownit() {
	local dir="$1"
	local recursive="${2:-true}"

	local have
	have="$(stat -c '%u:%g' "$dir" 2>/dev/null)" || return 0
	echo "- $dir ... "

	if [ "$have" != "$PUID:$PGID" ]; then
		if [ "$recursive" = 'true' ] && [ -d "$dir" ]; then
			chown -R "$PUID:$PGID" "$dir"
		else
			chown "$PUID:$PGID" "$dir"
		fi
		echo "    DONE"
	else
		echo "    SKIPPED"
	fi
}

for loc in "${locations[@]}"; do
	chownit "$loc"
done

# Handle certbot ownership (Alpine installs in /usr/bin, not /opt/certbot)
if [ -d "/opt/certbot" ]; then
	log_info 'Changing ownership of certbot /opt/certbot directories ...'
	chownit "/opt/certbot" false
	chownit "/opt/certbot/bin" false
	find /opt/certbot/lib -type d -name "site-packages" 2>/dev/null | while read -r sp; do
		chownit "$sp"
	done
else
	log_info 'certbot not in /opt/certbot, skipping'
fi
