// [Custom] 自動プル機能: ヘッダーのプル中 / 失敗表示用に WebSocket を購読するフック。
// App.tsx 既存の ws と props 配線を共有せず、独立した薄い接続を 1 本張ることで
// upstream への変更を Navigation.tsx の埋め込み 1 行のみに抑える。

import { useEffect, useRef, useState } from "react";

export type PullUiState = "idle" | "pulling" | "failed";

const RECONNECT_DELAY = 5000; // 切断時の再接続待ち（useHealthCheck と同値）
const FAILED_DISPLAY_MS = 4000; // 失敗表示を自動で消すまでの時間

export function usePullStatus(): PullUiState {
	const [state, setState] = useState<PullUiState>("idle");
	const wsRef = useRef<WebSocket | null>(null);
	const failedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;

		const clearFailedTimer = () => {
			if (failedTimerRef.current) {
				clearTimeout(failedTimerRef.current);
				failedTimerRef.current = null;
			}
		};

		const connect = () => {
			if (!mountedRef.current) return;
			if (
				wsRef.current &&
				(wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
			) {
				return;
			}
			try {
				const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
				const ws = new WebSocket(`${protocol}//${window.location.host}`);
				wsRef.current = ws;

				ws.onmessage = (event) => {
					if (event.data === "pull-started") {
						clearFailedTimer();
						setState("pulling");
					} else if (event.data === "pull-finished") {
						clearFailedTimer();
						setState("idle");
					} else if (event.data === "pull-failed") {
						clearFailedTimer();
						setState("failed");
						failedTimerRef.current = setTimeout(() => {
							if (mountedRef.current) setState("idle");
						}, FAILED_DISPLAY_MS);
					}
				};

				ws.onclose = () => {
					wsRef.current = null;
					if (mountedRef.current) {
						reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
					}
				};
			} catch {
				// 接続失敗時は次回再接続に委ねる
			}
		};

		// StrictMode での connect/disconnect 連打を避けるため少し遅らせる
		const connectTimer = setTimeout(connect, 100);

		return () => {
			mountedRef.current = false;
			clearTimeout(connectTimer);
			clearFailedTimer();
			if (reconnectRef.current) {
				clearTimeout(reconnectRef.current);
				reconnectRef.current = null;
			}
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, []);

	return state;
}
