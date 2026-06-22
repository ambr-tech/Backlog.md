export type TimingResult = "completed" | "failed";

export type TimingReporter = (step: string, elapsedMs: number, result: TimingResult) => void;

export async function measureAsync<T>(
	step: string,
	reporter: TimingReporter | undefined,
	operation: () => Promise<T>,
): Promise<T> {
	const startedAt = performance.now();
	try {
		const value = await operation();
		reporter?.(step, performance.now() - startedAt, "completed");
		return value;
	} catch (error) {
		reporter?.(step, performance.now() - startedAt, "failed");
		throw error;
	}
}

export function measureSync<T>(step: string, reporter: TimingReporter | undefined, operation: () => T): T {
	const startedAt = performance.now();
	try {
		const value = operation();
		reporter?.(step, performance.now() - startedAt, "completed");
		return value;
	} catch (error) {
		reporter?.(step, performance.now() - startedAt, "failed");
		throw error;
	}
}
