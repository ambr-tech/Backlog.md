import { describe, expect, it } from "bun:test";
import { measureAsync, measureSync, type TimingResult } from "../utils/operation-timing.ts";

describe("operation timing", () => {
	it("reports completed async and sync operations", async () => {
		const reports: Array<{ step: string; elapsedMs: number; result: TimingResult }> = [];
		const reporter = (step: string, elapsedMs: number, result: TimingResult) => {
			reports.push({ step, elapsedMs, result });
		};

		const asyncValue = await measureAsync("async step", reporter, async () => "async value");
		const syncValue = measureSync("sync step", reporter, () => "sync value");

		expect(asyncValue).toBe("async value");
		expect(syncValue).toBe("sync value");
		expect(reports.map(({ step, result }) => ({ step, result }))).toEqual([
			{ step: "async step", result: "completed" },
			{ step: "sync step", result: "completed" },
		]);
		expect(reports.every(({ elapsedMs }) => elapsedMs >= 0)).toBe(true);
	});

	it("reports failed operations and rethrows the original error", async () => {
		const reports: Array<{ step: string; result: TimingResult }> = [];
		const expectedError = new Error("timed failure");

		await expect(
			measureAsync(
				"failing step",
				(step, _elapsedMs, result) => reports.push({ step, result }),
				async () => {
					throw expectedError;
				},
			),
		).rejects.toBe(expectedError);
		expect(reports).toEqual([{ step: "failing step", result: "failed" }]);
	});
});
