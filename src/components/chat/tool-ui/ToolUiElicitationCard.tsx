import * as React from "react";
import type {
	ElicitationResponse,
	ElicitationSchema,
} from "../../../domain/models/chat-message";
import {
	buildElicitationResponseContent,
	createInitialElicitationValues,
	getElicitationValueAtPath,
	listElicitationFormFields,
	setElicitationValueAtPath,
	validateElicitationValues,
} from "../../../shared/elicitation-form";
import { ElicitationArrayEditor } from "../ElicitationArrayEditor";
import {
	canUseStructuredArrayEditor,
	flattenReceiptEntries,
	formatReceiptValue,
	groupFieldsBySection,
	groupReceiptEntriesBySection,
	resolveArrayItemType,
} from "../../../shared/elicitation-ui";

interface ToolUiElicitationCardProps {
	requestId: string;
	message: string;
	requestedSchema: ElicitationSchema;
	status:
		| "pending"
		| "submitted"
		| "completed"
		| "declined"
		| "cancelled"
		| "failed";
	response?: ElicitationResponse;
	error?: string;
	showEmojis: boolean;
	onSubmit?: (response: ElicitationResponse) => Promise<void>;
}

function formatStatusLabel(
	status: ToolUiElicitationCardProps["status"],
): string {
	switch (status) {
		case "completed":
			return "Input confirmed";
		case "declined":
			return "Request declined";
		case "cancelled":
			return "Request cancelled";
		case "submitted":
			return "Submitted";
		case "failed":
		case "pending":
		default:
			return "Awaiting input";
	}
}

function statusIcon(status: ToolUiElicitationCardProps["status"]): string {
	switch (status) {
		case "completed":
		case "submitted":
			return "✓ ";
		case "declined":
			return "⊘ ";
		case "cancelled":
			return "↩ ";
		case "failed":
			return "⚠ ";
		case "pending":
		default:
			return "🧩 ";
	}
}

export function ToolUiElicitationCard({
	requestId,
	message,
	requestedSchema,
	status,
	response,
	error,
	showEmojis,
	onSubmit,
}: ToolUiElicitationCardProps) {
	const [values, setValues] = React.useState<Record<string, unknown>>(() =>
		createInitialElicitationValues(requestedSchema),
	);
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const showForm = status === "pending" || status === "failed";
	const isInteractive = showForm && !isSubmitting;

	const fields = React.useMemo(
		() => listElicitationFormFields(requestedSchema),
		[requestedSchema],
	);
	const sectionedFields = React.useMemo(
		() => groupFieldsBySection(fields),
		[fields],
	);

	React.useEffect(() => {
		if (status === "pending") {
			setValues(createInitialElicitationValues(requestedSchema));
			setErrors({});
			setIsSubmitting(false);
		}
	}, [requestId, requestedSchema, status]);

	const handleFieldChange = React.useCallback(
		(path: string, value: unknown) => {
			setValues((prev) => setElicitationValueAtPath(prev, path, value));
			setErrors((prev) => {
				if (!prev[path]) {
					return prev;
				}
				const next = { ...prev };
				delete next[path];
				return next;
			});
		},
		[],
	);

	const submit = React.useCallback(
		async (action: ElicitationResponse["action"]) => {
			if (!isInteractive || !onSubmit) {
				return;
			}

			if (action === "accept") {
				const nextErrors = validateElicitationValues(
					requestedSchema,
					values,
				);
				setErrors(nextErrors);
				if (Object.keys(nextErrors).length > 0) {
					return;
				}
			}

			setIsSubmitting(true);
			try {
				if (action === "accept") {
					await onSubmit({
						action: "accept",
						content: buildElicitationResponseContent(
							requestedSchema,
							values,
						),
					});
				} else {
					await onSubmit({ action });
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[isInteractive, onSubmit, requestedSchema, values],
	);

	const responseEntries = React.useMemo(
		() => flattenReceiptEntries(requestedSchema, response),
		[requestedSchema, response],
	);
	const sectionedResponseEntries = React.useMemo(
		() => groupReceiptEntriesBySection(responseEntries),
		[responseEntries],
	);

	return (
		<div
			className="agent-client-tool-ui-elicitation-card"
			data-request-id={requestId}
			role="group"
			aria-label="Additional input required"
		>
			<div className="agent-client-tool-ui-elicitation-header">
				<div className="agent-client-tool-ui-elicitation-title">
					{showEmojis ? (showForm ? "🧩 " : statusIcon(status)) : ""}
					Additional input required
				</div>
				<div className="agent-client-tool-ui-elicitation-subtitle">
					{message}
				</div>
			</div>

			{status === "failed" && error && (
				<div
					className="agent-client-tool-ui-elicitation-error-banner"
					role="alert"
				>
					<strong>Submission failed:</strong> {error}
					<span className="agent-client-tool-ui-elicitation-error-banner-hint">
						Please review your input and try again.
					</span>
				</div>
			)}

			{showForm && (
				<>
					<div className="agent-client-tool-ui-elicitation-fields">
						{sectionedFields.map((group) => (
							<div
								key={group.section || "__default__"}
								className="agent-client-tool-ui-elicitation-section"
							>
								{group.section && (
									<div className="agent-client-tool-ui-elicitation-section-title">
										{group.section}
									</div>
								)}
								{group.fields.map((field) => {
									const { property } = field;
									const fieldId = `elicitation-${requestId}-${field.path}`;
									const value = getElicitationValueAtPath(
										values,
										field.path,
									);
									const fieldError = errors[field.path];
									const useStructuredArrayEditor =
										canUseStructuredArrayEditor(property);
									const isJsonArrayField =
										(property.type === "array" &&
											!useStructuredArrayEditor) ||
										property.ui?.widget === "json";
									const enumOptions =
										property.type !== "array"
											? property.enum
											: undefined;
									const minValue =
										property.type !== "array"
											? property.minimum
											: undefined;
									const maxValue =
										property.type !== "array"
											? property.maximum
											: undefined;
									const isTextareaField =
										property.ui?.widget === "textarea" ||
										isJsonArrayField;
									const arrayInputValue =
										typeof value === "string"
											? value
											: Array.isArray(value)
												? JSON.stringify(value, null, 2)
												: "";
									const arrayItemType =
										resolveArrayItemType(property);
									const arrayValues = Array.isArray(value)
										? value
										: [];

									return (
										<div
											key={field.path}
											className="agent-client-tool-ui-elicitation-field"
										>
											<label
												htmlFor={fieldId}
												className="agent-client-tool-ui-elicitation-label"
											>
												{field.label}
												{field.required && (
													<span className="agent-client-tool-ui-elicitation-required">
														*
													</span>
												)}
											</label>

											{field.description && (
												<div className="agent-client-tool-ui-elicitation-description">
													{field.description}
												</div>
											)}

											{enumOptions ? (
												<select
													id={fieldId}
													className="agent-client-tool-ui-elicitation-input"
													disabled={!isInteractive}
													value={
														value !== null &&
														value !== undefined
															? String(
																	value as
																		| string
																		| number
																		| boolean,
																)
															: ""
													}
													onChange={(event) =>
														handleFieldChange(
															field.path,
															event.target.value,
														)
													}
												>
													{enumOptions.map(
														(option: string) => {
															const optionLabel =
																String(
																	option as
																		| string
																		| number
																		| boolean,
																);
															return (
																<option
																	key={
																		optionLabel
																	}
																	value={
																		optionLabel
																	}
																>
																	{
																		optionLabel
																	}
																</option>
															);
														},
													)}
												</select>
											) : property.type === "boolean" ? (
												<label className="agent-client-tool-ui-elicitation-checkbox-row">
													<input
														id={fieldId}
														type="checkbox"
														disabled={
															!isInteractive
														}
														checked={Boolean(value)}
														onChange={(event) =>
															handleFieldChange(
																field.path,
																event.target
																	.checked,
															)
														}
													/>
													<span>Enabled</span>
												</label>
											) : useStructuredArrayEditor ? (
												<ElicitationArrayEditor
													fieldPath={field.path}
													values={arrayValues}
													itemType={arrayItemType}
													isInteractive={
														isInteractive
													}
													onChange={(
														path,
														nextValues,
													) =>
														handleFieldChange(
															path,
															nextValues,
														)
													}
													classNames={{
														container:
															"agent-client-tool-ui-elicitation-array-editor",
														empty: "agent-client-tool-ui-elicitation-array-empty",
														row: "agent-client-tool-ui-elicitation-array-item",
														input: "agent-client-tool-ui-elicitation-input",
														checkboxRow:
															"agent-client-tool-ui-elicitation-checkbox-row",
														addButton:
															"agent-client-tool-ui-elicitation-button",
														removeButton:
															"agent-client-tool-ui-elicitation-button agent-client-tool-ui-elicitation-array-remove",
													}}
												/>
											) : isTextareaField ? (
												<textarea
													id={fieldId}
													className="agent-client-tool-ui-elicitation-input agent-client-tool-ui-elicitation-textarea"
													disabled={!isInteractive}
													placeholder={
														property.ui
															?.placeholder ??
														(isJsonArrayField
															? 'Enter JSON array, e.g. ["item"]'
															: undefined)
													}
													rows={
														property.ui?.rows ?? 4
													}
													value={arrayInputValue}
													onChange={(event) =>
														handleFieldChange(
															field.path,
															event.target.value,
														)
													}
												/>
											) : (
												<input
													id={fieldId}
													type={
														property.type ===
															"number" ||
														property.type ===
															"integer"
															? "number"
															: "text"
													}
													className="agent-client-tool-ui-elicitation-input"
													disabled={!isInteractive}
													value={
														value !== null &&
														value !== undefined
															? String(
																	value as
																		| string
																		| number
																		| boolean,
																)
															: ""
													}
													min={minValue}
													max={maxValue}
													step={
														property.type ===
														"integer"
															? 1
															: "any"
													}
													onChange={(event) =>
														handleFieldChange(
															field.path,
															event.target.value,
														)
													}
												/>
											)}

											{fieldError && (
												<div className="agent-client-tool-ui-elicitation-error">
													{fieldError}
												</div>
											)}
										</div>
									);
								})}
							</div>
						))}
					</div>

					<div className="agent-client-tool-ui-elicitation-actions">
						<button
							type="button"
							className="agent-client-tool-ui-elicitation-button agent-client-tool-ui-elicitation-button-submit"
							disabled={!isInteractive}
							onClick={() => void submit("accept")}
						>
							Submit
						</button>
						<button
							type="button"
							className="agent-client-tool-ui-elicitation-button"
							disabled={!isInteractive}
							onClick={() => void submit("decline")}
						>
							Decline
						</button>
						<button
							type="button"
							className="agent-client-tool-ui-elicitation-button"
							disabled={!isInteractive}
							onClick={() => void submit("cancel")}
						>
							Cancel
						</button>
					</div>
				</>
			)}

			{!showForm && (
				<div
					className={`agent-client-tool-ui-elicitation-receipt agent-client-tool-ui-elicitation-receipt--${status}`}
					role="status"
				>
					<div className="agent-client-tool-ui-elicitation-receipt-title">
						{showEmojis ? statusIcon(status) : ""}
						{formatStatusLabel(status)}
					</div>
					{responseEntries.length > 0 && (
						<div className="agent-client-tool-ui-elicitation-receipt-fields">
							{sectionedResponseEntries.map((group) => (
								<div
									key={group.section || "__default__"}
									className="agent-client-tool-ui-elicitation-receipt-section"
								>
									{group.section && (
										<div className="agent-client-tool-ui-elicitation-receipt-section-title">
											{group.section}
										</div>
									)}
									{group.entries.map((entry) => (
										<div
											key={entry.key}
											className="agent-client-tool-ui-elicitation-receipt-field"
										>
											<span className="agent-client-tool-ui-elicitation-receipt-field-key">
												{entry.label}
											</span>
											<span className="agent-client-tool-ui-elicitation-receipt-field-value">
												{formatReceiptValue(
													entry.value,
												)}
											</span>
										</div>
									))}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
