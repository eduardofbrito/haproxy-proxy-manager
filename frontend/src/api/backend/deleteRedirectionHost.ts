import * as api from "./base";

export async function deleteRedirectionHost(id: number): Promise<boolean> {
	return await api.del({
		url: `/haproxy/redirection-hosts/${id}`,
	});
}
