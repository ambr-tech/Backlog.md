// [Custom] タスク詳細モーダルの開閉と URL (/tasks/:taskId) を同期する副作用専用コンポーネント
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../../src/types/index.ts";
import { buildTaskPath, isTaskPath, parseTaskPath } from "./taskUrlPath.ts";

interface Props {
	tasks: Task[];
	editingTask: Task | null;
	showModal: boolean;
	isLoading: boolean;
	onOpenTask: (task: Task) => void;
	onCloseTask: () => void;
}

export const TaskUrlSync: React.FC<Props> = ({
	tasks,
	editingTask,
	showModal,
	isLoading,
	onOpenTask,
	onCloseTask,
}) => {
	const location = useLocation();
	const navigate = useNavigate();
	// 直近で同期した taskId。URL 由来 / state 由来どちらの起点でも更新し、二重発火を防ぐ
	const lastSyncedTaskIdRef = useRef<string | null>(null);
	// 直接アクセスでマウントされた場合に true。閉じる時に navigate(-1) ではなく replace でフォールバック
	const isDirectAccessRef = useRef(isTaskPath(location.pathname));

	// URL -> state: pathname に taskId が含まれていればモーダルを開く
	useEffect(() => {
		const urlTaskId = parseTaskPath(location.pathname);

		if (urlTaskId) {
			if (lastSyncedTaskIdRef.current === urlTaskId) return;
			if (editingTask?.id === urlTaskId && showModal) {
				lastSyncedTaskIdRef.current = urlTaskId;
				return;
			}
			const task = tasks.find((t) => t.id === urlTaskId);
			if (task) {
				lastSyncedTaskIdRef.current = urlTaskId;
				onOpenTask(task);
			}
			// 未発見 (削除済み等) の場合は何もしない。ロード完了後に再評価される
			return;
		}

		// URL から taskId が消えた (戻る等) のにモーダルが開いている場合は閉じる
		if (showModal && editingTask) {
			lastSyncedTaskIdRef.current = null;
			onCloseTask();
		} else {
			lastSyncedTaskIdRef.current = null;
		}
	}, [location.pathname, tasks, isLoading, editingTask, showModal, onOpenTask, onCloseTask]);

	// state -> URL: モーダル開閉に応じて navigate
	useEffect(() => {
		// 編集モード (既存タスク) を開いた時のみ URL を書き換える。新規作成 (editingTask === null) は対象外
		if (showModal && editingTask) {
			if (lastSyncedTaskIdRef.current === editingTask.id) return;
			const currentTaskId = parseTaskPath(location.pathname);
			if (currentTaskId === editingTask.id) {
				lastSyncedTaskIdRef.current = editingTask.id;
				return;
			}
			lastSyncedTaskIdRef.current = editingTask.id;
			navigate(buildTaskPath(editingTask.id, location.search));
			return;
		}

		// モーダルが閉じられた時、URL が /tasks/:id のままなら戻す
		if (!showModal && isTaskPath(location.pathname)) {
			lastSyncedTaskIdRef.current = null;
			if (isDirectAccessRef.current) {
				// 直接アクセスで開いたタブは履歴が無いため replace で /tasks へ
				isDirectAccessRef.current = false;
				navigate(`/tasks${location.search}`, { replace: true });
			} else {
				navigate(-1);
			}
		}
	}, [showModal, editingTask, location.pathname, location.search, navigate]);

	return null;
};
