// [Custom] タスク詳細モーダルの開閉と URL (/tasks/:taskId) を同期する副作用専用コンポーネント
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../../src/types/index.ts";
import { buildTaskPath, isTaskPath, parseTaskPath } from "./taskUrlPath.ts";

// [Custom] 調査用ログの共通プレフィックス。本番では LOG_ENABLED を false に
const LOG_PREFIX = "[TaskUrlSync]";
const LOG_ENABLED = true;
const log = (label: string, payload?: Record<string, unknown>) => {
	if (!LOG_ENABLED) return;
	if (payload) {
		console.log(`${LOG_PREFIX} ${label}`, payload);
	} else {
		console.log(`${LOG_PREFIX} ${label}`);
	}
};

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
	// 両 effect を「URL 変化のみ」「state 変化のみ」で発火させるため、依存配列に出さない値はすべて ref 経由で参照する。
	// (親 App.tsx の handleEditTask/handleCloseModal は useCallback されておらず、毎レンダー fresh な参照になるため)
	const editingTaskRef = useRef(editingTask);
	const showModalRef = useRef(showModal);
	const tasksRef = useRef(tasks);
	const isLoadingRef = useRef(isLoading);
	const onOpenTaskRef = useRef(onOpenTask);
	const onCloseTaskRef = useRef(onCloseTask);
	const locationRef = useRef(location);
	const navigateRef = useRef(navigate);
	useEffect(() => {
		editingTaskRef.current = editingTask;
		showModalRef.current = showModal;
		tasksRef.current = tasks;
		isLoadingRef.current = isLoading;
		onOpenTaskRef.current = onOpenTask;
		onCloseTaskRef.current = onCloseTask;
		locationRef.current = location;
		navigateRef.current = navigate;
	});

	// マウント時の状態を 1 度だけログ
	useEffect(() => {
		log("mount", {
			pathname: location.pathname,
			search: location.search,
			isDirectAccess: isDirectAccessRef.current,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// URL -> state: pathname に taskId が含まれていればモーダルを開く。URL 変化時のみ発火する。
	useEffect(() => {
		const urlTaskId = parseTaskPath(location.pathname);
		const currentEditingTask = editingTaskRef.current;
		const currentShowModal = showModalRef.current;
		const currentTasks = tasksRef.current;
		const currentIsLoading = isLoadingRef.current;
		const onOpenTask = onOpenTaskRef.current;
		const onCloseTask = onCloseTaskRef.current;
		log("effect:URL->state fire", {
			pathname: location.pathname,
			urlTaskId,
			lastSynced: lastSyncedTaskIdRef.current,
			editingTaskId: currentEditingTask?.id ?? null,
			showModal: currentShowModal,
			isLoading: currentIsLoading,
			tasksLen: currentTasks.length,
		});

		if (urlTaskId) {
			if (lastSyncedTaskIdRef.current === urlTaskId) {
				log("effect:URL->state skip (already synced)", { urlTaskId });
				return;
			}
			if (currentEditingTask?.id === urlTaskId && currentShowModal) {
				lastSyncedTaskIdRef.current = urlTaskId;
				log("effect:URL->state align ref (state already matches URL)", { urlTaskId });
				return;
			}
			const task = currentTasks.find((t) => t.id === urlTaskId);
			if (task) {
				lastSyncedTaskIdRef.current = urlTaskId;
				log("effect:URL->state -> onOpenTask", { urlTaskId });
				onOpenTask(task);
			} else {
				log("effect:URL->state task not found in list", { urlTaskId, tasksLen: currentTasks.length });
			}
			// 未発見 (削除済み等) の場合は何もしない。ロード完了後に再評価される
			return;
		}

		// URL から taskId が消えた (戻る等) のにモーダルが開いている場合は閉じる
		if (currentShowModal && currentEditingTask) {
			lastSyncedTaskIdRef.current = null;
			log("effect:URL->state -> onCloseTask (URL has no taskId but modal open)");
			onCloseTask();
		} else {
			lastSyncedTaskIdRef.current = null;
			log("effect:URL->state clear ref (no task in URL, modal closed)");
		}
		// 依存配列は URL と tasks のみ。tasks は App 側 useState 由来で setTasks 時のみ参照が変わるため、
		// ロード完了で直リン /tasks/<id> の再評価が必要なケースを拾える。
		// onOpenTask/onCloseTask は親で useCallback されていないため依存配列に入れず ref 経由で参照する。
	}, [location.pathname, tasks]);

	// state -> URL: モーダル開閉に応じて navigate。state 変化時のみ発火する。
	// 初回マウントは skip — 直リン /tasks/<id> 直アクセス時に「閉じている (false)」状態で誤って navigate(-1) してしまうのを防ぐ。
	// 直リンのモーダル開動作は URL->state effect 側で onOpenTask が走ることで実現される。
	const isFirstStateEffectRef = useRef(true);
	useEffect(() => {
		const currentLocation = locationRef.current;
		const navigate = navigateRef.current;
		log("effect:state->URL fire", {
			showModal,
			editingTaskId: editingTask?.id ?? null,
			pathname: currentLocation.pathname,
			search: currentLocation.search,
			lastSynced: lastSyncedTaskIdRef.current,
			isFirstMount: isFirstStateEffectRef.current,
		});

		if (isFirstStateEffectRef.current) {
			isFirstStateEffectRef.current = false;
			log("effect:state->URL skip (initial mount)");
			return;
		}

		// 編集モード (既存タスク) を開いた時のみ URL を書き換える。新規作成 (editingTask === null) は対象外
		if (showModal && editingTask) {
			if (lastSyncedTaskIdRef.current === editingTask.id) {
				log("effect:state->URL skip (already synced via ref)", { taskId: editingTask.id });
				return;
			}
			const currentTaskId = parseTaskPath(currentLocation.pathname);
			if (currentTaskId === editingTask.id) {
				lastSyncedTaskIdRef.current = editingTask.id;
				log("effect:state->URL align ref (URL already matches state)", { taskId: editingTask.id });
				return;
			}
			lastSyncedTaskIdRef.current = editingTask.id;
			const nextPath = buildTaskPath(editingTask.id, currentLocation.search);
			log("effect:state->URL navigate(push)", { from: currentLocation.pathname, to: nextPath });
			navigate(nextPath);
			return;
		}

		// モーダルが閉じられた時、URL が /tasks/:id のままなら戻す
		if (!showModal && isTaskPath(currentLocation.pathname)) {
			lastSyncedTaskIdRef.current = null;
			if (isDirectAccessRef.current) {
				// 直接アクセスで開いたタブは履歴が無いため replace で /tasks へ
				isDirectAccessRef.current = false;
				log("effect:state->URL navigate(replace) -> /tasks (direct access fallback)");
				navigate(`/tasks${currentLocation.search}`, { replace: true });
			} else {
				log("effect:state->URL navigate(-1) (back to previous URL)");
				navigate(-1);
			}
		} else {
			log("effect:state->URL no-op", {
				showModal,
				isTaskPath: isTaskPath(currentLocation.pathname),
			});
		}
	}, [showModal, editingTask]);

	return null;
};
