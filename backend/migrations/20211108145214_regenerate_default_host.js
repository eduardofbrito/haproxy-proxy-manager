import internalHaproxy from "../internal/haproxy.js";
import { migrate as logger } from "../logger.js";

const migrateName = "stream_domain";

async function regenerateDefaultHost(knex) {
	const row = await knex("setting").select("*").where("id", "default-site").first();

	if (!row) {
		return Promise.resolve();
	}

	return internalHaproxy
		.deleteConfig("default")
		.then(() => {
			return internalHaproxy.generateConfig("default", row);
		})
		.then(() => {
			return internalHaproxy.test();
		})
		.then(() => {
			return internalHaproxy.reload();
		});
}

/**
 * Migrate
 *
 * @see http://knexjs.org/#Schema
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
const up = (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	return regenerateDefaultHost(knex);
};

/**
 * Undo Migrate
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
const down = (knex) => {
	logger.info(`[${migrateName}] Migrating Down...`);

	return regenerateDefaultHost(knex);
};

export { up, down };
