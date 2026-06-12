import * as api from "./base";

export async function toggleStream(id: number, enabled: boolean): Promise<boolean> {
	return await api.post({
		url: `/haproxy/streams/${id}/${enabled ? "enable" : "disable"}`,
	});
}
