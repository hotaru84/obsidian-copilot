import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

import type {
	ElicitationResponse,
	ElicitationSchema,
} from "../../domain/models/chat-message";
import {
	buildElicitationResponseContent,
	createInitialElicitationValues,
	validateElicitationValues,
} from "../../shared/elicitation-form";

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
				{Object.entries(requestedSchema.properties).map(
					([name, property]) => {
						const fieldId = `elicitation-${name}`;
						const value = values[name];
						const error = errors[name];
						const label = property.title || name;

						return (
							<div
								key={name}
								className="agent-client-elicitation-modal-field-group"
							>
								<label
									htmlFor={fieldId}
									className="agent-client-elicitation-modal-label"
								>
									{label}
									{(requestedSchema.required || []).includes(
										name,
									) && (
										<span className="agent-client-elicitation-modal-required">
											*
										</span>
									)}
								</label>
								{property.description && (
									<div className="agent-client-elicitation-modal-description">
										{property.description}
									</div>
								)}
								{property.enum ? (
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
												name,
												event.target.value,
											)
										}
									>
										{property.enum.map((option) => (
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
										))}
									</select>
								) : property.type === "boolean" ? (
									<label className="agent-client-elicitation-modal-checkbox-row">
										<input
											id={fieldId}
											type="checkbox"
											checked={Boolean(value)}
											onChange={(event) =>
												handleFieldChange(
													name,
													event.target.checked,
												)
											}
										/>
										<span>Enabled</span>
									</label>
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
								{error && (
									<div className="agent-client-elicitation-modal-error">
										{error}
									</div>
								)}
							</div>
						);
					},
				)}
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
