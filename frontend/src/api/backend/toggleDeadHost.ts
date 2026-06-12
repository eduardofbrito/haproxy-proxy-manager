import * as api from "./base";

export async function toggleDeadHost(id: number, enabled: boolean): Promise<boolean> {
	return await api.post({
		url: `/haproxy/dead-hosts/${id}/${enabled ? "enable" : "disable"}`,
	});
}
