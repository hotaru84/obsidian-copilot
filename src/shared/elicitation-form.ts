import type {
	ElicitationSchema,
	ElicitationSchemaProperty,
} from "../domain/models/chat-message";

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
	const required = new Set(schema.required || []);

	for (const key in schema.properties) {
		const property = schema.properties[key];
		const value = coerceElicitationValue(property, values[key]);

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

export function buildElicitationResponseContent(
	schema: ElicitationSchema,
	values: Record<string, unknown>,
): Record<string, unknown> {
	const content: Record<string, unknown> = {};
	for (const key in schema.properties) {
		const coerced = coerceElicitationValue(
			schema.properties[key],
			values[key],
		);
		if (coerced !== undefined && coerced !== "") {
			content[key] = coerced;
		}
	}
	return content;
}
