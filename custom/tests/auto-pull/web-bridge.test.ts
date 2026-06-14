// [Custom] 自動プル機能: WebSocket ブロードキャスタのテスト
import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import { makeAutoPullBroadcaster } from "../../src/auto-pull/web-bridge";

function fakeSocket(sink: string[], tag: string): ServerWebSocket<unknown> {
	return { send: (m: string) => sink.push(`${tag}:${m}`) } as unknown as ServerWebSocket<unknown>;
}

describe("makeAutoPullBroadcaster", () => {
	test("phase をメッセージへ変換し、全 socket へ送る", () => {
		const sent: string[] = [];
		const sockets = [fakeSocket(sent, "a"), fakeSocket(sent, "b")];
		const broadcast = makeAutoPullBroadcaster(() => sockets);
		broadcast("start");
		broadcast("finished");
		broadcast("failed");
		expect(sent).toEqual([
			"a:pull-started",
			"b:pull-started",
			"a:pull-finished",
			"b:pull-finished",
			"a:pull-failed",
			"b:pull-failed",
		]);
	});

	test("send が throw する socket があっても他へ送り続ける", () => {
		const sent: string[] = [];
		const bad = {
			send: () => {
				throw new Error("closed");
			},
		} as unknown as ServerWebSocket<unknown>;
		const good = fakeSocket(sent, "good");
		const broadcast = makeAutoPullBroadcaster(() => [bad, good]);
		broadcast("start");
		expect(sent).toEqual(["good:pull-started"]);
	});

	test("getSockets は都度評価され、接続増減に追従する", () => {
		const sent: string[] = [];
		let sockets: ServerWebSocket<unknown>[] = [];
		const broadcast = makeAutoPullBroadcaster(() => sockets);
		broadcast("start"); // 接続ゼロ
		sockets = [fakeSocket(sent, "late")];
		broadcast("finished");
		expect(sent).toEqual(["late:pull-finished"]);
	});
});
