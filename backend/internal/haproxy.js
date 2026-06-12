import fs from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import _ from "lodash";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { debug, haproxy as logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Config base directory for HAProxy config files
 */
const ConfigDir = "/data/haproxy/";

const internalHaproxy = {
	/**
	 * This will:
	 * - test the haproxy config first to make sure it's OK
	 * - create / recreate the config for the host
	 * - test again
	 * - IF OK:  update the meta with online status
	 * - IF BAD: update the meta with offline status and remove the config entirely
	 * - then reload haproxy
	 *
	 * @param   {Object|String}  model
	 * @param   {String}         host_type
	 * @param   {Object}         host
	 * @returns {Promise}
	 */
	configure: (model, host_type, host) => {
		let combined_meta = {};

		return internalHaproxy
			.test()
			.then(() => {
				// Delete the existing config regardless.
				// Don't throw errors, as the file may not exist at all
				return internalHaproxy.deleteConfig(host_type, host, true);
			})
			.then(() => {
				return internalHaproxy.generateConfig(host_type, host);
			})
			.then(() => {
				// Test haproxy again and update meta with result
				return internalHaproxy
					.test()
					.then(() => {
						// haproxy is ok
						combined_meta = _.assign({}, host.meta, {
							haproxy_online: true,
							haproxy_err: null,
						});

						return model.query().where("id", host.id).patch({
							meta: combined_meta,
						});
					})
					.catch((err) => {
						// config is bad, update meta and delete config
						combined_meta = _.assign({}, host.meta, {
							haproxy_online: false,
							haproxy_err: err.message,
						});

						return model
							.query()
							.where("id", host.id)
							.patch({
								meta: combined_meta,
							})
							.then(() => {
								internalHaproxy.renameConfigAsError(host_type, host);
							})
							.then(() => {
								return internalHaproxy.deleteConfig(host_type, host, true);
							});
					});
			})
			.then(() => {
				return internalHaproxy.reload();
			})
			.then(() => {
				return combined_meta;
			});
	},

	/**
	 * @returns {Promise}
	 */
	test: () => {
		debug(logger, "Testing HAProxy configuration");
		return utils.execFile("haproxy", ["-c", "-f", "/etc/haproxy/haproxy.cfg"]);
	},

	/**
	 * @returns {Promise}
	 */
	reload: () => {
		return internalHaproxy.test().then(() => {
			logger.info("Reloading HAProxy");
			return new Promise((resolve, reject) => {
				// Try to get PID from PID file and send HUP
				if (fs.existsSync("/var/run/haproxy.pid")) {
					try {
						const pid = parseInt(fs.readFileSync("/var/run/haproxy.pid", "utf8").trim(), 10);
						if (!isNaN(pid)) {
							fs.access("/proc/" + pid, fs.constants.F_OK, (err) => {
								if (!err) {
									// Process exists, send HUP signal
									utils.execFile("kill", ["-HUP", String(pid)])
										.then(() => resolve())
										.catch(() => {
											// Fallback: full restart
											utils.execFile("haproxy", ["-D", "-f", "/etc/haproxy/haproxy.cfg", "-p", "/var/run/haproxy.pid"])
												.then(() => resolve())
												.catch(reject);
										});
								} else {
									// Process gone, start fresh
									utils.execFile("haproxy", ["-D", "-f", "/etc/haproxy/haproxy.cfg", "-p", "/var/run/haproxy.pid"])
										.then(() => resolve())
										.catch(reject);
								}
							});
						} else {
							utils.execFile("haproxy", ["-D", "-f", "/etc/haproxy/haproxy.cfg", "-p", "/var/run/haproxy.pid"])
								.then(() => resolve())
								.catch(reject);
						}
					} catch (e) {
						utils.execFile("haproxy", ["-D", "-f", "/etc/haproxy/haproxy.cfg", "-p", "/var/run/haproxy.pid"])
							.then(() => resolve())
							.catch(reject);
					}
				} else {
					// No PID file, start fresh
					utils.execFile("haproxy", ["-D", "-f", "/etc/haproxy/haproxy.cfg", "-p", "/var/run/haproxy.pid"])
						.then(() => resolve())
						.catch(reject);
				}
			});
		});
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Integer} host_id
	 * @returns {String}
	 */
	getConfigName: (host_type, host_id) => {
		if (host_type === "default") {
			return ConfigDir + "default_host/site.cfg";
		}
		return ConfigDir + internalHaproxy.getFileFriendlyHostType(host_type) + "/" + host_id + ".cfg";
	},

	/**
	 * Generates custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderLocations: (host) => {
		return new Promise((resolve, reject) => {
			let template;

			try {
				template = fs.readFileSync(__dirname + "/../templates/_location.cfg", { encoding: "utf8" });
			} catch (err) {
				reject(new errs.ConfigurationError(err.message));
				return;
			}

			const renderEngine = utils.getRenderEngine();
			let renderedLocations = "";

			const locationRendering = async () => {
				for (let i = 0; i < host.locations.length; i++) {
					const locationCopy = Object.assign(
						{},
						{ access_list_id: host.access_list_id },
						{ certificate_id: host.certificate_id },
						{ ssl_forced: host.ssl_forced },
						{ caching_enabled: host.caching_enabled },
						{ block_exploits: host.block_exploits },
						{ allow_websocket_upgrade: host.allow_websocket_upgrade },
						{ http2_support: host.http2_support },
						{ hsts_enabled: host.hsts_enabled },
						{ hsts_subdomains: host.hsts_subdomains },
						{ access_list: host.access_list },
						{ certificate: host.certificate },
						host.locations[i],
					);

					if (locationCopy.forward_host.indexOf("/") > -1) {
						const splitted = locationCopy.forward_host.split("/");

						locationCopy.forward_host = splitted.shift();
						locationCopy.forward_path = "/" + splitted.join("/");
					}

					renderedLocations += await renderEngine.parseAndRender(template, locationCopy);
				}
			};

			locationRendering().then(() => resolve(renderedLocations));
		});
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	generateConfig: (host_type, host_row) => {
		// Prevent modifying the original object:
		const host = JSON.parse(JSON.stringify(host_row));
		const nice_host_type = internalHaproxy.getFileFriendlyHostType(host_type);

		debug(logger, `Generating ${nice_host_type} Config:`, JSON.stringify(host, null, 2));

		const renderEngine = utils.getRenderEngine();

		return new Promise((resolve, reject) => {
			let template = null;
			const filename = internalHaproxy.getConfigName(nice_host_type, host.id);

			try {
				template = fs.readFileSync(__dirname + "/../templates/" + nice_host_type + ".cfg", { encoding: "utf8" });
			} catch (err) {
				reject(new errs.ConfigurationError(err.message));
				return;
			}

			let locationsPromise;
			let origLocations;

			// Manipulate the data a bit before sending it to the template
			if (nice_host_type !== "default") {
				host.use_default_location = true;
				if (typeof host.advanced_config !== "undefined" && host.advanced_config) {
					host.use_default_location = !internalHaproxy.advancedConfigHasDefaultLocation(host.advanced_config);
				}
			}

			// For redirection hosts, if the scheme is not http or https, set it to $scheme
			if (nice_host_type === "redirection_host" && ["http", "https"].indexOf(host.forward_scheme.toLowerCase()) === -1) {
				host.forward_scheme = "$scheme";
			}

			if (host.locations) {
				origLocations = [].concat(host.locations);
				locationsPromise = internalHaproxy.renderLocations(host).then((renderedLocations) => {
					host.locations = renderedLocations;
				});

				// Allow someone who is using / custom location path to use it, and skip the default / location
				_.map(host.locations, (location) => {
					if (location.path === "/") {
						host.use_default_location = false;
					}
				});
			} else {
				locationsPromise = Promise.resolve();
			}

			// Set the IPv6 setting for the host
			host.ipv6 = internalHaproxy.ipv6Enabled();

			locationsPromise.then(() => {
				renderEngine
					.parseAndRender(template, host)
					.then((config_text) => {
						fs.writeFileSync(filename, config_text, { encoding: "utf8" });
						debug(logger, "Wrote config:", filename, config_text);

						// Restore locations array
						host.locations = origLocations;

						resolve(true);
					})
					.catch((err) => {
						debug(logger, `Could not write ${filename}:`, err.message);
						reject(new errs.ConfigurationError(err.message));
					});
			});
		});
	},

	/**
	 * This generates a temporary HAProxy config listening on port 80 for the domain names listed
	 * in the certificate setup. It allows the letsencrypt acme challenge to be requested by letsencrypt
	 * when requesting a certificate without having a hostname set up already.
	 *
	 * @param   {Object}  certificate
	 * @returns {Promise}
	 */
	generateLetsEncryptRequestConfig: (certificate) => {
		debug(logger, "Generating LetsEncrypt Request Config:", certificate);
		const renderEngine = utils.getRenderEngine();

		return new Promise((resolve, reject) => {
			let template = null;
			const filename = ConfigDir + "temp/letsencrypt_" + certificate.id + ".cfg";

			try {
				template = fs.readFileSync(__dirname + "/../templates/letsencrypt-request.cfg", { encoding: "utf8" });
			} catch (err) {
				reject(new errs.ConfigurationError(err.message));
				return;
			}

			certificate.ipv6 = internalHaproxy.ipv6Enabled();

			renderEngine
				.parseAndRender(template, certificate)
				.then((config_text) => {
					fs.writeFileSync(filename, config_text, { encoding: "utf8" });
					debug(logger, "Wrote config:", filename, config_text);
					resolve(true);
				})
				.catch((err) => {
					debug(logger, `Could not write ${filename}:`, err.message);
					reject(new errs.ConfigurationError(err.message));
				});
		});
	},

	/**
	 * A simple wrapper around unlinkSync that writes to the logger
	 *
	 * @param   {String}  filename
	 */
	deleteFile: (filename) => {
		if (!fs.existsSync(filename)) {
			return;
		}
		try {
			debug(logger, `Deleting file: ${filename}`);
			fs.unlinkSync(filename);
		} catch (err) {
			debug(logger, "Could not delete file:", JSON.stringify(err, null, 2));
		}
	},

	/**
	 *
	 * @param   {String} host_type
	 * @returns String
	 */
	getFileFriendlyHostType: (host_type) => {
		return host_type.replace(/-/g, "_");
	},

	/**
	 * This removes the temporary HAProxy config file generated by `generateLetsEncryptRequestConfig`
	 *
	 * @param   {Object}  certificate
	 * @returns {Promise}
	 */
	deleteLetsEncryptRequestConfig: (certificate) => {
		const config_file = ConfigDir + "temp/letsencrypt_" + certificate.id + ".cfg";
		return new Promise((resolve /*, reject*/) => {
			internalHaproxy.deleteFile(config_file);
			resolve();
		});
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @param   {Boolean} [delete_err_file]
	 * @returns {Promise}
	 */
	deleteConfig: (host_type, host, delete_err_file) => {
		const config_file = internalHaproxy.getConfigName(
			internalHaproxy.getFileFriendlyHostType(host_type),
			typeof host === "undefined" ? 0 : host.id,
		);
		const config_file_err = config_file + ".err";

		return new Promise((resolve /*, reject*/) => {
			internalHaproxy.deleteFile(config_file);
			if (delete_err_file) {
				internalHaproxy.deleteFile(config_file_err);
			}
			resolve();
		});
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @returns {Promise}
	 */
	renameConfigAsError: (host_type, host) => {
		const config_file = internalHaproxy.getConfigName(
			internalHaproxy.getFileFriendlyHostType(host_type),
			typeof host === "undefined" ? 0 : host.id,
		);
		const config_file_err = config_file + ".err";

		return new Promise((resolve /*, reject*/) => {
			fs.unlink(config_file, () => {
				// ignore result, continue
				fs.rename(config_file, config_file_err, () => {
					// also ignore result, as this is a debugging informative file anyway
					resolve();
				});
			});
		});
	},

	/**
	 * @param   {String}  hostType
	 * @param   {Array}   hosts
	 * @returns {Promise}
	 */
	bulkGenerateConfigs: (hostType, hosts) => {
		const promises = [];
		hosts.map((host) => {
			promises.push(internalHaproxy.generateConfig(hostType, host));
			return true;
		});

		return Promise.all(promises);
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Array}   hosts
	 * @returns {Promise}
	 */
	bulkDeleteConfigs: (host_type, hosts) => {
		const promises = [];
		hosts.map((host) => {
			promises.push(internalHaproxy.deleteConfig(host_type, host, true));
			return true;
		});

		return Promise.all(promises);
	},

	/**
	 * @param   {string}  config
	 * @returns {boolean}
	 */
	advancedConfigHasDefaultLocation: (cfg) => {
		// Check for HAProxy default routing: frontend blocks or use_backend directives
		return !!cfg.match(/^(?:.*;)?\s*?(?:frontend|use_backend)\b/im);
	},

	/**
	 * @returns {boolean}
	 */
	ipv6Enabled: () => {
		if (typeof process.env.DISABLE_IPV6 !== "undefined") {
			const disabled = process.env.DISABLE_IPV6.toLowerCase();
			return !(disabled === "on" || disabled === "true" || disabled === "1" || disabled === "yes");
		}

		return true;
	},
};

export default internalHaproxy;
