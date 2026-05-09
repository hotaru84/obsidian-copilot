import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

import type {
	ElicitationResponse,
	ElicitationSchema,
} from "../../domain/models/chat-message";
import { ElicitationArrayEditor } from "./ElicitationArrayEditor";
import {
	buildElicitationResponseContent,
	createInitialElicitationValues,
	getElicitationValueAtPath,
	listElicitationFormFields,
	setElicitationValueAtPath,
	validateElicitationValues,
} from "../../shared/elicitation-form";
import {
	canUseStructuredArrayEditor,
	groupFieldsBySection,
	resolveArrayItemType,
} from "../../shared/elicitation-ui";

interface ElicitationModalProps {
	message: string;
	requestedSchema: ElicitationSchema;
	onSubmit: (response: ElicitationResponse) => void | Promise<void>;
}

function ElicitationForm({
	message,
	requestedSchema,
	onSubmit,
}: ElicitationModalProps) {
	const [values, setValues] = React.useState<Record<string, unknown>>(() =>
		createInitialElicitationValues(requestedSchema),
	);
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const fields = React.useMemo(
		() => listElicitationFormFields(requestedSchema),
		[requestedSchema],
	);
	const sectionedFields = React.useMemo(() => {
		return groupFieldsBySection(fields);
	}, [fields]);
	const isInteractive = !isSubmitting;

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

	const submitResponse = React.useCallback(
		async (response: ElicitationResponse) => {
			if (isSubmitting) {
				return;
			}

			if (response.action === "accept") {
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
				await onSubmit(
					response.action === "accept"
						? {
								action: "accept",
								content: buildElicitationResponseContent(
									requestedSchema,
									values,
								),
							}
						: response,
				);
			} finally {
				setIsSubmitting(false);
			}
		},
		[isSubmitting, onSubmit, requestedSchema, values],
	);

	return (
		<div className="agent-client-elicitation-modal">
			<p className="agent-client-elicitation-modal-message">{message}</p>
			<div className="agent-client-elicitation-modal-fields">
				{sectionedFields.map((group) => (
					<div
						key={group.section || "__default__"}
						className="agent-client-elicitation-modal-section"
					>
						{group.section && (
							<div className="agent-client-elicitation-modal-section-title">
								{group.section}
							</div>
						)}
						{group.fields.map((field) => {
							const { property } = field;
							const fieldId = `elicitation-${field.path}`;
							const value = getElicitationValueAtPath(
								values,
								field.path,
							);
							const error = errors[field.path];
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
									className="agent-client-elicitation-modal-field-group"
								>
									<label
										htmlFor={fieldId}
										className="agent-client-elicitation-modal-label"
									>
										{field.label}
										{field.required && (
											<span className="agent-client-elicitation-modal-required">
												*
											</span>
										)}
									</label>
									{field.description && (
										<div className="agent-client-elicitation-modal-description">
											{field.description}
										</div>
									)}
									{enumOptions ? (
										<select
											id={fieldId}
											className="agent-client-elicitation-modal-input"
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
												(option: string) => (
													<option
														key={String(
															option as
																| string
																| number
																| boolean,
														)}
														value={String(
															option as
																| string
																| number
																| boolean,
														)}
													>
														{String(
															option as
																| string
																| number
																| boolean,
														)}
													</option>
												),
											)}
										</select>
									) : property.type === "boolean" ? (
										<label className="agent-client-elicitation-modal-checkbox-row">
											<input
												id={fieldId}
												type="checkbox"
												disabled={!isInteractive}
												checked={Boolean(value)}
												onChange={(event) =>
													handleFieldChange(
														field.path,
														event.target.checked,
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
											isInteractive={isInteractive}
											onChange={(path, nextValues) =>
												handleFieldChange(
													path,
													nextValues,
												)
											}
											classNames={{
												container:
													"agent-client-elicitation-modal-array-editor",
												empty: "agent-client-elicitation-modal-array-empty",
												row: "agent-client-elicitation-modal-array-item",
												input: "agent-client-elicitation-modal-input",
												checkboxRow:
													"agent-client-elicitation-modal-checkbox-row",
												addButton: "",
												removeButton: "",
											}}
										/>
									) : isTextareaField ? (
										<textarea
											id={fieldId}
											className="agent-client-elicitation-modal-input agent-client-elicitation-modal-textarea"
											disabled={!isInteractive}
											placeholder={
												property.ui?.placeholder ??
												(isJsonArrayField
													? 'Enter JSON array, e.g. ["item"]'
													: undefined)
											}
											rows={property.ui?.rows ?? 4}
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
												property.type === "number" ||
												property.type === "integer"
													? "number"
													: "text"
											}
											className="agent-client-elicitation-modal-input"
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
												property.type === "integer"
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
									{error && (
										<div className="agent-client-elicitation-modal-error">
											{error}
										</div>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
			<div className="agent-client-elicitation-modal-actions">
				<button
					type="button"
					className="mod-cta"
					disabled={isSubmitting}
					onClick={() => void submitResponse({ action: "accept" })}
				>
					Submit
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					onClick={() => void submitResponse({ action: "decline" })}
				>
					Decline
				</button>
				<button
					type="button"
					disabled={isSubmitting}
					onClick={() => void submitResponse({ action: "cancel" })}
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

export class ElicitationModal extends Modal {
	private root: Root | null = null;
	private props: ElicitationModalProps;

	constructor(app: App, props: ElicitationModalProps) {
		super(app);
		this.props = props;
	}

	updateProps(props: ElicitationModalProps) {
		this.props = props;
		this.renderContent();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Additional input required" });
		const reactContainer = contentEl.createDiv();
		this.root = createRoot(reactContainer);
		this.renderContent();
	}

	private renderContent() {
		if (!this.root) {
			return;
		}

		this.root.render(
			React.createElement(ElicitationForm, {
				...this.props,
				onSubmit: async (response: ElicitationResponse) => {
					await this.props.onSubmit(response);
					this.close();
				},
			}),
		);
	}

	onClose() {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		this.contentEl.empty();
	}
}
