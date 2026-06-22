import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ApiClient, ApiError, NetworkError } from "../web/lib/api.ts";

describe("Web API errors", () => {
	it("uses server error payloads as the user-facing message", () => {
		const error = ApiError.fromResponse(new Response(null, { status: 400, statusText: "Bad Request" }), {
			error: "Comment body cannot contain standalone '---' delimiter lines.",
		});

		expect(error.message).toBe("Comment body cannot contain standalone '---' delimiter lines.");
		expect(error.status).toBe(400);
	});

	it("falls back to HTTP status text when no server error payload exists", () => {
		const error = ApiError.fromResponse(new Response(null, { status: 404, statusText: "Not Found" }));

		expect(error.message).toBe("HTTP 404: Not Found");
	});
});

describe("Web API retry behavior", () => {
	const originalFetch = globalThis.fetch;
	let fetchCalls = 0;

	beforeEach(() => {
		fetchCalls = 0;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("does not retry mutation requests after AbortError", async () => {
		globalThis.fetch = (async () => {
			fetchCalls++;
			throw new DOMException("The operation was aborted.", "AbortError");
		}) as unknown as typeof fetch;

		const client = new ApiClient();

		await expect(
			client.createTask({
				title: "Test task",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: [],
			}),
		).rejects.toThrow(NetworkError);
		expect(fetchCalls).toBe(1);
	});

	it("retries safe GET requests after transient failures", async () => {
		globalThis.fetch = (async () => {
			fetchCalls++;
			if (fetchCalls === 1) {
				throw new TypeError("Failed to fetch");
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}) as unknown as typeof fetch;

		const client = new ApiClient();
		const tasks = await client.fetchTasks();

		expect(tasks).toEqual([]);
		expect(fetchCalls).toBe(2);
	});
});
