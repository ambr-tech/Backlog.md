// [Custom] Assignee / Labels の入力でサジェスト + キーボードナビゲーションを提供するチップ入力
import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface SuggestChipInputProps {
	value: string[];
	onChange: (values: string[]) => void;
	suggestions: string[];
	placeholder?: string;
	label?: string;
	name: string;
	disabled?: boolean;
}

export const SuggestChipInput: React.FC<SuggestChipInputProps> = ({
	value,
	onChange,
	suggestions,
	placeholder,
	label,
	name,
	disabled,
}) => {
	const [inputValue, setInputValue] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [open, setOpen] = useState(false);
	const inputId = `suggest-chip-input-${name}`;
	const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
		};
	}, []);

	const filtered = useMemo(() => {
		const query = inputValue.trim().toLowerCase();
		if (!query) return [] as string[];
		return suggestions.filter(
			(s) => !value.includes(s) && s.toLowerCase().includes(query),
		);
	}, [inputValue, suggestions, value]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [inputValue, filtered.length]);

	const commit = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) {
			setInputValue("");
			return;
		}
		if (!value.includes(trimmed)) {
			onChange([...value, trimmed]);
		}
		setInputValue("");
		setOpen(false);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return;
		const hasSuggestions = open && filtered.length > 0;
		if (hasSuggestions && e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1) % filtered.length);
			return;
		}
		if (hasSuggestions && e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
			return;
		}
		if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
			e.preventDefault();
			if (hasSuggestions && filtered[selectedIndex]) {
				commit(filtered[selectedIndex]);
			} else {
				commit(inputValue);
			}
			return;
		}
		if (e.key === "Backspace" && !inputValue && value.length > 0) {
			onChange(value.slice(0, -1));
			return;
		}
		if (e.key === "Escape") {
			setOpen(false);
			setInputValue("");
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) return;
		const newValue = e.target.value;
		if (newValue.endsWith(",")) {
			const head = newValue.slice(0, -1);
			const hasSuggestions = open && filtered.length > 0;
			if (hasSuggestions && filtered[selectedIndex] && head.trim()) {
				commit(filtered[selectedIndex]);
			} else {
				commit(head);
			}
			return;
		}
		setInputValue(newValue);
		setOpen(true);
	};

	const handleFocus = () => {
		if (blurTimerRef.current) {
			clearTimeout(blurTimerRef.current);
			blurTimerRef.current = null;
		}
		if (inputValue.trim()) setOpen(true);
	};

	const handleBlur = () => {
		// クリックでのサジェスト確定を取りこぼさないよう少し遅延
		blurTimerRef.current = setTimeout(() => setOpen(false), 150);
	};

	const removeChip = (index: number) => {
		if (disabled) return;
		onChange(value.filter((_, i) => i !== index));
	};

	return (
		<div className="w-full relative">
			{label ? (
				<label
					htmlFor={inputId}
					className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-200"
				>
					{label}
				</label>
			) : null}
			<div
				className={`relative w-full min-h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400 focus-within:border-transparent transition-colors duration-200 pr-2 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
			>
				<div className="flex flex-wrap gap-2 items-center w-full">
					{value.map((item, index) => (
						<span
							key={`${item}-${index}`}
							className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md flex-shrink-0 min-w-0 max-w-full transition-colors duration-200"
						>
							<span className="truncate max-w-[16rem] sm:max-w-[20rem] md:max-w-[24rem]">{item}</span>
							{!disabled && (
								<button
									type="button"
									onClick={() => removeChip(index)}
									className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-sm p-0.5 transition-colors duration-200"
									aria-label={`Remove ${item}`}
								>
									<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clipRule="evenodd"
										/>
									</svg>
								</button>
							)}
						</span>
					))}
					<input
						id={inputId}
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						onFocus={handleFocus}
						onBlur={handleBlur}
						placeholder={value.length === 0 ? placeholder : ""}
						className="flex-1 min-w-[2ch] outline-none text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
						disabled={disabled}
						autoComplete="off"
						aria-autocomplete="list"
						aria-expanded={open && filtered.length > 0}
						aria-controls={`${inputId}-listbox`}
					/>
				</div>
			</div>

			{open && filtered.length > 0 && (
				<ul
					id={`${inputId}-listbox`}
					role="listbox"
					className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-auto overscroll-contain transition-colors duration-200"
				>
					{filtered.map((item, index) => (
						<li key={item} role="option" aria-selected={index === selectedIndex}>
							<button
								type="button"
								// onMouseDown は input の blur より先に発火するため、blur 経由のクローズ前に確定できる
								onMouseDown={(e) => {
									e.preventDefault();
									commit(item);
								}}
								className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ${
									index === selectedIndex ? "bg-gray-100 dark:bg-gray-700" : ""
								} text-gray-900 dark:text-white`}
							>
								{item}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default SuggestChipInput;
