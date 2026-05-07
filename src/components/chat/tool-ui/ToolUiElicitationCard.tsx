import * as React from "react";
import type {
	ElicitationResponse,
	ElicitationSchema,
	ElicitationSchemaProperty,
} from "../../../domain/models/chat-message";

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

function getDefaultValue(property: ElicitationSchemaProperty): unknown {
	if (property.default !== undefined) {
		return property.default;
	}

	if (property.enum && property.enum.length > 0) {
		return property.enum[0];
	}

	switch (property.type) {
		case "boolean":
			return false;
		case "number":
		case "integer":
			return "";
		case "string":
		default:
			return "";
	}
}

function createInitialValues(
	schema: ElicitationSchema,
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key in schema.properties) {
		values[key] = getDefaultValue(schema.properties[key]);
	}
	return values;
}

function coerceValue(
	property: ElicitationSchemaProperty,
	rawValue: unknown,
): unknown {
	if (property.type === "boolean") {
		return Boolean(rawValue);
	}

	if (property.type === "number" || property.type === "integer") {
		if (rawValue === "" || rawValue === null || rawValue === undefined) {
			return undefined;
		}
		const numericValue = Number(rawValue);
		if (Number.isNaN(numericValue)) {
			return rawValue;
		}
		return property.type === "integer"
			? Math.trunc(numericValue)
			: numericValue;
	}

	return rawValue;
}

function validateValues(
	schema: ElicitationSchema,
	values: Record<string, unknown>,
): Record<string, string> {
	const errors: Record<string, string> = {};
	const required = new Set(schema.required || []);

	for (const key in schema.properties) {
		const property = schema.properties[key];
		const value = coerceValue(property, values[key]);

		if (
			required.has(key) &&
			(value === undefined || value === null || value === "")
		) {
			errors[key] = "This field is required.";
			continue;
		}

		if (
			(property.type === "number" || property.type === "integer") &&
			value !== undefined &&
			value !== ""
		) {
			if (typeof value !== "number" || Number.isNaN(value)) {
				errors[key] = "Enter a valid number.";
				continue;
			}
			if (property.minimum !== undefined && value < property.minimum) {
				errors[key] = `Must be at least ${property.minimum}.`;
				continue;
			}
			if (property.maximum !== undefined && value > property.maximum) {
				errors[key] = `Must be at most ${property.maximum}.`;
				continue;
			}
		}

		if (
			property.enum &&
			value !== undefined &&
			value !== "" &&
			!property.enum.includes(String(value as string | number | boolean))
		) {
			errors[key] = "Select a valid option.";
		}
	}

	return errors;
}

function buildResponseContent(
	schema: ElicitationSchema,
	values: Record<string, unknown>,
): Record<string, unknown> {
	const content: Record<string, unknown> = {};
	for (const key in schema.properties) {
		const coerced = coerceValue(schema.properties[key], values[key]);
		if (coerced !== undefined && coerced !== "") {
			content[key] = coerced;
		}
	}
	return content;
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
		createInitialValues(requestedSchema),
	);
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const showForm = status === "pending" || status === "failed";
	const isInteractive = showForm && !isSubmitting;

	React.useEffect(() => {
		if (status === "pending") {
			setValues(createInitialValues(requestedSchema));
			setErrors({});
			setIsSubmitting(false);
		}
	}, [requestId, requestedSchema, status]);

	const handleFieldChange = React.useCallback(
		(name: string, value: unknown) => {
			setValues((prev) => ({
				...prev,
				[name]: value,
			}));
			setErrors((prev) => {
				if (!prev[name]) {
					return prev;
				}
				const next = { ...prev };
				delete next[name];
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
				const nextErrors = validateValues(requestedSchema, values);
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
						content: buildResponseContent(requestedSchema, values),
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

	const responseEntries = Object.entries(response?.content ?? {});

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
						{Object.entries(requestedSchema.properties).map(
							([name, property]) => {
								const fieldId = `elicitation-${requestId}-${name}`;
								const value = values[name];
								const fieldError = errors[name];
								const label = property.title || name;
								const required = (
									requestedSchema.required || []
								).includes(name);

								return (
									<div
										key={name}
										className="agent-client-tool-ui-elicitation-field"
									>
										<label
											htmlFor={fieldId}
											className="agent-client-tool-ui-elicitation-label"
										>
											{label}
											{required && (
												<span className="agent-client-tool-ui-elicitation-required">
													*
												</span>
											)}
										</label>
										{property.description && (
											<div className="agent-client-tool-ui-elicitation-description">
												{property.description}
											</div>
										)}
										{property.enum ? (
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
														name,
														event.target.value,
													)
												}
											>
												{property.enum.map((option) => {
													const optionLabel = String(
														option as
															| string
															| number
															| boolean,
													);
													return (
														<option
															key={optionLabel}
															value={optionLabel}
														>
															{optionLabel}
														</option>
													);
												})}
											</select>
										) : property.type === "boolean" ? (
											<label className="agent-client-tool-ui-elicitation-checkbox-row">
												<input
													id={fieldId}
													type="checkbox"
													disabled={!isInteractive}
													checked={Boolean(value)}
													onChange={(event) =>
														handleFieldChange(
															name,
															event.target
																.checked,
														)
													}
												/>
												<span>Enabled</span>
											</label>
										) : (
											<input
												id={fieldId}
												type={
													property.type ===
														"number" ||
													property.type === "integer"
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
												min={property.minimum}
												max={property.maximum}
												step={
													property.type === "integer"
														? 1
														: "any"
												}
												onChange={(event) =>
													handleFieldChange(
														name,
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
							},
						)}
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
							{responseEntries.map(([key, value]) => {
								const prop = requestedSchema.properties[key];
								const label = prop?.title ?? key;
								return (
									<div
										key={key}
										className="agent-client-tool-ui-elicitation-receipt-field"
									>
										<span className="agent-client-tool-ui-elicitation-receipt-field-key">
											{label}
										</span>
										<span className="agent-client-tool-ui-elicitation-receipt-field-value">
											{String(
												value as
													| string
													| number
													| boolean,
											)}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
