import * as api from "./base";

export async function deleteAccessList(id: number): Promise<boolean> {
	return await api.del({
		url: `/haproxy/access-lists/${id}`,
	});
}
