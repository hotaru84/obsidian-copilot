import * as React from "react";

import type { PrimitiveArrayItemType } from "../../shared/elicitation-ui";
import { parseArrayItem } from "../../shared/elicitation-ui";

interface ElicitationArrayEditorClassNames {
	container: string;
	empty: string;
	row: string;
	input: string;
	checkboxRow: string;
	addButton: string;
	removeButton: string;
}

interface ElicitationArrayEditorProps {
	fieldPath: string;
	values: unknown[];
	itemType: PrimitiveArrayItemType;
	isInteractive: boolean;
	onChange: (path: string, value: unknown[]) => void;
	classNames: ElicitationArrayEditorClassNames;
	addLabel?: string;
	removeLabel?: string;
	emptyLabel?: string;
}

export function ElicitationArrayEditor({
	fieldPath,
	values,
	itemType,
	isInteractive,
	onChange,
	classNames,
	addLabel = "Add item",
	removeLabel = "Remove",
	emptyLabel = "No items yet.",
}: ElicitationArrayEditorProps) {
	const handleItemChange = React.useCallback(
		(index: number, rawValue: string | boolean) => {
			const next = [...values];
			next[index] = parseArrayItem(itemType, rawValue);
			onChange(fieldPath, next);
		},
		[fieldPath, itemType, onChange, values],
	);

	const handleRemove = React.useCallback(
		(index: number) => {
			const next = values.filter((_, itemIndex) => itemIndex !== index);
			onChange(fieldPath, next);
		},
		[fieldPath, onChange, values],
	);

	const handleAdd = React.useCallback(() => {
		const defaultItem = itemType === "boolean" ? false : "";
		onChange(fieldPath, [...values, defaultItem]);
	}, [fieldPath, itemType, onChange, values]);

	return (
		<div className={classNames.container}>
			{values.length === 0 && (
				<div className={classNames.empty}>{emptyLabel}</div>
			)}
			{values.map((item, index) => (
				<div key={`${fieldPath}-${index}`} className={classNames.row}>
					{itemType === "boolean" ? (
						<label className={classNames.checkboxRow}>
							<input
								type="checkbox"
								disabled={!isInteractive}
								checked={Boolean(item)}
								onChange={(event) =>
									handleItemChange(
										index,
										event.target.checked,
									)
								}
							/>
							<span>Item {index + 1}</span>
						</label>
					) : (
						<input
							type={
								itemType === "number" || itemType === "integer"
									? "number"
									: "text"
							}
							className={classNames.input}
							disabled={!isInteractive}
							step={itemType === "integer" ? 1 : "any"}
							value={
								item === null || item === undefined
									? ""
									: String(item)
							}
							onChange={(event) =>
								handleItemChange(index, event.target.value)
							}
						/>
					)}
					<button
						type="button"
						className={classNames.removeButton}
						disabled={!isInteractive}
						onClick={() => handleRemove(index)}
					>
						{removeLabel}
					</button>
				</div>
			))}
			<button
				type="button"
				className={classNames.addButton}
				disabled={!isInteractive}
				onClick={handleAdd}
			>
				{addLabel}
			</button>
		</div>
	);
}
