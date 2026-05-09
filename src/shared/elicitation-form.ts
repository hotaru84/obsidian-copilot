import type {
	ElicitationArraySchemaProperty,
	ElicitationSchema,
	ElicitationPrimitiveSchemaProperty,
	ElicitationSchemaProperty,
} from "../domain/models/chat-message";

export interface ElicitationFormField {
	path: string;
	property:
		| ElicitationPrimitiveSchemaProperty
		| ElicitationArraySchemaProperty;
	label: string;
	description?: string;
	required: boolean;
	depth: number;
	order: number;
	section?: string;
}

function clonePathValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(clonePathValue);
	}

	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(
			value as Record<string, unknown>,
		)) {
			result[key] = clonePathValue(nested);
		}
		return result;
	}

	return value;
}

function getDefaultValue(property: ElicitationSchemaProperty): unknown {
	if (property.default !== undefined) {
		return property.default;
	}

	if (property.type === "object") {
		const nested: Record<string, unknown> = {};
		for (const key in property.properties) {
			nested[key] = getDefaultValue(property.properties[key]);
		}
		return nested;
	}

	if (property.type === "array") {
		return [];
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

function pathSegments(path: string): string[] {
	return path.split(".").filter((segment) => segment.length > 0);
}

export function getElicitationValueAtPath(
	values: Record<string, unknown>,
	path: string,
): unknown {
	const segments = pathSegments(path);
	let current: unknown = values;

	for (const segment of segments) {
		if (!current || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}

	return current;
}

export function setElicitationValueAtPath(
	values: Record<string, unknown>,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const segments = pathSegments(path);
	if (segments.length === 0) {
		return values;
	}

	const next = clonePathValue(values) as Record<string, unknown>;
	let cursor: Record<string, unknown> = next;

	for (let index = 0; index < segments.length - 1; index += 1) {
		const segment = segments[index];
		const existing = cursor[segment];
		if (
			!existing ||
			typeof existing !== "object" ||
			Array.isArray(existing)
		) {
			cursor[segment] = {};
		}
		cursor = cursor[segment] as Record<string, unknown>;
	}

	cursor[segments[segments.length - 1]] = value;
	return next;
}

export function listElicitationFormFields(
	schema: ElicitationSchema,
): ElicitationFormField[] {
	const fields: ElicitationFormField[] = [];

	const walk = (
		properties: Record<string, ElicitationSchemaProperty>,
		required: Set<string>,
		prefix: string,
		depth: number,
		parentLabel: string,
	): void => {
		for (const [key, property] of Object.entries(properties)) {
			const path = prefix ? `${prefix}.${key}` : key;
			const localLabel = property.title || key;
			const label = parentLabel
				? `${parentLabel} / ${localLabel}`
				: localLabel;

			if (property.type === "object") {
				walk(
					property.properties,
					new Set(property.required || []),
					path,
					depth + 1,
					label,
				);
				continue;
			}

			fields.push({
				path,
				property,
				label,
				description: property.description,
				required: required.has(key),
				depth,
				order: property.ui?.order ?? Number.MAX_SAFE_INTEGER,
				section: property.ui?.section,
			});
		}
	};

	walk(schema.properties, new Set(schema.required || []), "", 0, "");

	return fields.sort((a, b) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}
		return a.path.localeCompare(b.path);
	});
}

function validatePrimitiveValue(
	property: ElicitationPrimitiveSchemaProperty,
	value: unknown,
): string | undefined {
	if (
		(property.type === "number" || property.type === "integer") &&
		value !== undefined &&
		value !== ""
	) {
		if (typeof value !== "number" || Number.isNaN(value)) {
			return "Enter a valid number.";
		}
		if (property.minimum !== undefined && value < property.minimum) {
			return `Must be at least ${property.minimum}.`;
		}
		if (property.maximum !== undefined && value > property.maximum) {
			return `Must be at most ${property.maximum}.`;
		}
	}

	if (
		property.enum &&
		value !== undefined &&
		value !== "" &&
		!property.enum.includes(String(value as string | number | boolean))
	) {
		return "Select a valid option.";
	}

	return undefined;
}

export function createInitialElicitationValues(
	schema: ElicitationSchema,
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const key in schema.properties) {
		values[key] = getDefaultValue(schema.properties[key]);
	}
	return values;
}

export function coerceElicitationValue(
	property: ElicitationSchemaProperty,
	rawValue: unknown,
): unknown {
	if (property.type === "array") {
		if (Array.isArray(rawValue)) {
			return rawValue;
		}

		if (typeof rawValue === "string") {
			const trimmed = rawValue.trim();
			if (trimmed.length === 0) {
				return undefined;
			}
			try {
				const parsed = JSON.parse(trimmed);
				return Array.isArray(parsed) ? parsed : rawValue;
			} catch {
				return rawValue;
			}
		}

		if (rawValue === null || rawValue === undefined) {
			return undefined;
		}

		return rawValue;
	}

	if (property.type === "object") {
		if (
			!rawValue ||
			typeof rawValue !== "object" ||
			Array.isArray(rawValue)
		) {
			return undefined;
		}
		return rawValue;
	}

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

export function validateElicitationValues(
	schema: ElicitationSchema,
	values: Record<string, unknown>,
): Record<string, string> {
	const errors: Record<string, string> = {};

	const walk = (
		properties: Record<string, ElicitationSchemaProperty>,
		required: Set<string>,
		currentValues: Record<string, unknown>,
		prefix: string,
	): void => {
		for (const [key, property] of Object.entries(properties)) {
			const path = prefix ? `${prefix}.${key}` : key;
			const value = coerceElicitationValue(property, currentValues[key]);

			if (
				required.has(key) &&
				(value === undefined || value === null || value === "")
			) {
				errors[path] = "This field is required.";
				continue;
			}

			if (property.type === "object") {
				if (value === undefined) {
					continue;
				}
				if (
					!value ||
					typeof value !== "object" ||
					Array.isArray(value)
				) {
					errors[path] = "Enter a valid object.";
					continue;
				}
				walk(
					property.properties,
					new Set(property.required || []),
					value as Record<string, unknown>,
					path,
				);
				continue;
			}

			if (property.type === "array") {
				if (value === undefined || value === "") {
					continue;
				}
				if (!Array.isArray(value)) {
					errors[path] = "Enter a valid JSON array.";
					continue;
				}
				if (
					property.minItems !== undefined &&
					value.length < property.minItems
				) {
					errors[path] =
						`Must include at least ${property.minItems} item(s).`;
					continue;
				}
				if (
					property.maxItems !== undefined &&
					value.length > property.maxItems
				) {
					errors[path] =
						`Must include at most ${property.maxItems} item(s).`;
				}
				continue;
			}

			const primitiveError = validatePrimitiveValue(property, value);
			if (primitiveError) {
				errors[path] = primitiveError;
			}
		}
	};

	walk(schema.properties, new Set(schema.required || []), values, "");

	return errors;
}

export function buildElicitationResponseContent(
	schema: ElicitationSchema,
	values: Record<string, unknown>,
): Record<string, unknown> {
	const content: Record<string, unknown> = {};

	const walk = (
		properties: Record<string, ElicitationSchemaProperty>,
		source: Record<string, unknown>,
		target: Record<string, unknown>,
	): void => {
		for (const [key, property] of Object.entries(properties)) {
			const coerced = coerceElicitationValue(property, source[key]);
			if (coerced === undefined || coerced === "") {
				continue;
			}

			if (property.type === "object") {
				if (
					!coerced ||
					typeof coerced !== "object" ||
					Array.isArray(coerced)
				) {
					continue;
				}
				const nested: Record<string, unknown> = {};
				walk(
					property.properties,
					coerced as Record<string, unknown>,
					nested,
				);
				if (Object.keys(nested).length > 0) {
					target[key] = nested;
				}
				continue;
			}

			target[key] = coerced;
		}
	};

	walk(schema.properties, values, content);
	return content;
}
