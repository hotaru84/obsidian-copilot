import * as React from "react";
import type {
	ElicitationResponse,
	ElicitationSchema,
} from "../../../domain/models/chat-message";
import {
	buildElicitationResponseContent,
	createInitialElicitationValues,
	validateElicitationValues,
} from "../../../shared/elicitation-form";

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

	React.useEffect(() => {
		if (status === "pending") {
			setValues(createInitialElicitationValues(requestedSchema));
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
