// [Custom] タスク詳細モーダルの開閉と URL クエリ (?task=<id>) を同期する副作用専用コンポーネント。
// pathname ではなく search を介すことで、ベース画面 (Board / Milestones / All Tasks 等) を維持したまま
// モーダルを重ねられる。
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../../src/types/index.ts";
import {
	buildSearchWithTaskId,
	buildSearchWithoutTaskId,
	hasTaskId,
	parseTaskId,
} from "./taskUrlPath.ts";

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
	const isDirectAccessRef = useRef(hasTaskId(location.search));
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

	// URL -> state: search の task クエリに応じてモーダルを開く。URL 変化時のみ発火する。
	useEffect(() => {
		const urlTaskId = parseTaskId(location.search);
		const currentEditingTask = editingTaskRef.current;
		const currentShowModal = showModalRef.current;
		const currentTasks = tasksRef.current;
		const currentIsLoading = isLoadingRef.current;
		const onOpenTask = onOpenTaskRef.current;
		const onCloseTask = onCloseTaskRef.current;
		log("effect:URL->state fire", {
			pathname: location.pathname,
			search: location.search,
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
			// 未発見 (削除済み等) の場合は何もしない。ロード完了後に tasks 変化で再評価される
			return;
		}

		// URL から task クエリが消えた (戻る等) のにモーダルが開いている場合は閉じる
		if (currentShowModal && currentEditingTask) {
			lastSyncedTaskIdRef.current = null;
			log("effect:URL->state -> onCloseTask (URL has no task query but modal open)");
			onCloseTask();
		} else {
			lastSyncedTaskIdRef.current = null;
			log("effect:URL->state clear ref (no task in URL, modal closed)");
		}
		// 依存配列は URL の search と tasks のみ。tasks ロード完了で直リン再評価を拾うため。
		// onOpenTask/onCloseTask は親で useCallback されていないため依存配列に入れず ref 経由で参照する。
	}, [location.search, tasks]);

	// state -> URL: モーダル開閉に応じて navigate。state 変化時のみ発火する。
	// 初回マウントは skip — 直リン直アクセス時に「閉じている (false)」状態で誤って戻り動作が発生するのを防ぐ。
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
			const currentTaskId = parseTaskId(currentLocation.search);
			if (currentTaskId === editingTask.id) {
				lastSyncedTaskIdRef.current = editingTask.id;
				log("effect:state->URL align ref (URL already matches state)", { taskId: editingTask.id });
				return;
			}
			lastSyncedTaskIdRef.current = editingTask.id;
			const nextSearch = buildSearchWithTaskId(currentLocation.search, editingTask.id);
			log("effect:state->URL navigate(push)", {
				from: `${currentLocation.pathname}${currentLocation.search}`,
				to: `${currentLocation.pathname}${nextSearch}`,
			});
			navigate({ pathname: currentLocation.pathname, search: nextSearch });
			return;
		}

		// モーダルが閉じられた時、URL に task クエリが残っているなら外す
		if (!showModal && hasTaskId(currentLocation.search)) {
			lastSyncedTaskIdRef.current = null;
			if (isDirectAccessRef.current) {
				// 直接アクセスで開いたタブは履歴が無いため replace で task クエリを外す
				isDirectAccessRef.current = false;
				const nextSearch = buildSearchWithoutTaskId(currentLocation.search);
				log("effect:state->URL navigate(replace) -> remove task query (direct access fallback)", {
					to: `${currentLocation.pathname}${nextSearch}`,
				});
				navigate({ pathname: currentLocation.pathname, search: nextSearch }, { replace: true });
			} else {
				log("effect:state->URL navigate(-1) (back to previous URL)");
				navigate(-1);
			}
		} else {
			log("effect:state->URL no-op", {
				showModal,
				hasTaskId: hasTaskId(currentLocation.search),
			});
		}
	}, [showModal, editingTask]);

	return null;
};
