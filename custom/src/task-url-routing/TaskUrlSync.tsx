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

	// URL -> state: search の task クエリに応じてモーダルを開く。URL 変化時のみ発火する。
	useEffect(() => {
		const urlTaskId = parseTaskId(location.search);
		const currentEditingTask = editingTaskRef.current;
		const currentShowModal = showModalRef.current;
		const currentTasks = tasksRef.current;
		const onOpenTask = onOpenTaskRef.current;
		const onCloseTask = onCloseTaskRef.current;

		if (urlTaskId) {
			if (lastSyncedTaskIdRef.current === urlTaskId) return;
			if (currentEditingTask?.id === urlTaskId && currentShowModal) {
				lastSyncedTaskIdRef.current = urlTaskId;
				return;
			}
			const task = currentTasks.find((t) => t.id === urlTaskId);
			if (task) {
				lastSyncedTaskIdRef.current = urlTaskId;
				onOpenTask(task);
			}
			// 未発見 (削除済み等) の場合は何もしない。ロード完了後に tasks 変化で再評価される
			return;
		}

		// URL から task クエリが消えた (戻る等) のにモーダルが開いている場合は閉じる
		if (currentShowModal && currentEditingTask) {
			lastSyncedTaskIdRef.current = null;
			onCloseTask();
		} else {
			lastSyncedTaskIdRef.current = null;
		}
		// 依存配列は URL の search と tasks のみ。tasks ロード完了で直リン再評価を拾うため。
		// onOpenTask/onCloseTask は親で useCallback されていないため依存配列に入れず ref 経由で参照する。
	}, [location.search, tasks]);

	// state -> URL: モーダル開閉に応じて navigate。state 変化時のみ発火する。
	// 初回マウントは skip — 直リン直アクセス時に「閉じている (false)」状態で誤って戻り動作が発生するのを防ぐ。
	// 直リンのモーダル開動作は URL->state effect 側で onOpenTask が走ることで実現される。
	const isFirstStateEffectRef = useRef(true);
	useEffect(() => {
		if (isFirstStateEffectRef.current) {
			isFirstStateEffectRef.current = false;
			return;
		}
		const currentLocation = locationRef.current;
		const navigate = navigateRef.current;

		// 編集モード (既存タスク) を開いた時のみ URL を書き換える。新規作成 (editingTask === null) は対象外
		if (showModal && editingTask) {
			if (lastSyncedTaskIdRef.current === editingTask.id) return;
			const currentTaskId = parseTaskId(currentLocation.search);
			if (currentTaskId === editingTask.id) {
				lastSyncedTaskIdRef.current = editingTask.id;
				return;
			}
			lastSyncedTaskIdRef.current = editingTask.id;
			const nextSearch = buildSearchWithTaskId(currentLocation.search, editingTask.id);
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
				navigate({ pathname: currentLocation.pathname, search: nextSearch }, { replace: true });
			} else {
				navigate(-1);
			}
		}
	}, [showModal, editingTask]);

	return null;
};
