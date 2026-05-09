import type {
	ElicitationResponse,
	ElicitationSchema,
	ElicitationSchemaProperty,
} from "../domain/models/chat-message";
import type { ElicitationFormField } from "./elicitation-form";

export interface ElicitationReceiptEntry {
	key: string;
	label: string;
	value: unknown;
	section?: string;
}

export type PrimitiveArrayItemType =
	| "string"
	| "number"
	| "integer"
	| "boolean";

export function canUseStructuredArrayEditor(
	property: ElicitationSchemaProperty,
): boolean {
	if (property.type !== "array") {
		return false;
	}

	return (
		property.ui?.widget !== "json" &&
		(property.items.type === "string" ||
			property.items.type === "number" ||
			property.items.type === "integer" ||
			property.items.type === "boolean")
	);
}

export function resolveArrayItemType(
	property: ElicitationSchemaProperty,
): PrimitiveArrayItemType {
	if (
		property.type === "array" &&
		(property.items.type === "string" ||
			property.items.type === "number" ||
			property.items.type === "integer" ||
			property.items.type === "boolean")
	) {
		return property.items.type;
	}

	return "string";
}

export function parseArrayItem(
	itemType: PrimitiveArrayItemType,
	rawValue: string | boolean,
): unknown {
	if (itemType === "boolean") {
		return Boolean(rawValue);
	}

	if (itemType === "number" || itemType === "integer") {
		if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
			return "";
		}
		const numericValue = Number(rawValue);
		if (Number.isNaN(numericValue)) {
			return rawValue;
		}
		return itemType === "integer" ? Math.trunc(numericValue) : numericValue;
	}

	return String(rawValue);
}

export function groupFieldsBySection(
	fields: ElicitationFormField[],
): Array<{ section: string; fields: ElicitationFormField[] }> {
	const sections = new Map<string, ElicitationFormField[]>();
	for (const field of fields) {
		const section = field.section || "";
		const existing = sections.get(section) || [];
		existing.push(field);
		sections.set(section, existing);
	}

	return Array.from(sections.entries()).map(([section, groupedFields]) => ({
		section,
		fields: groupedFields,
	}));
}

export function formatReceiptValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "object") {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return "[object]";
		}
	}

	return String(value);
}

export function flattenReceiptEntries(
	schema: ElicitationSchema,
	response: ElicitationResponse | undefined,
): ElicitationReceiptEntry[] {
	const content = response?.content ?? {};
	const entries: ElicitationReceiptEntry[] = [];

	const collectFromProperty = (
		property: ElicitationSchemaProperty,
		value: unknown,
		label: string,
		key: string,
		inheritedSection?: string,
	): void => {
		const section = property.ui?.section ?? inheritedSection;

		if (
			property.type === "object" &&
			value &&
			typeof value === "object" &&
			!Array.isArray(value)
		) {
			for (const [childKey, childProperty] of Object.entries(
				property.properties,
			)) {
				const nestedValue = (value as Record<string, unknown>)[
					childKey
				];
				if (nestedValue === undefined) {
					continue;
				}
				const nestedLabel = `${label} / ${childProperty.title ?? childKey}`;
				const nestedKey = `${key}.${childKey}`;
				collectFromProperty(
					childProperty,
					nestedValue,
					nestedLabel,
					nestedKey,
					section,
				);
			}
			return;
		}

		if (property.type === "array" && Array.isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				const itemValue = value[index];
				const itemLabel = `${label} [${index + 1}]`;
				const itemKey = `${key}[${index}]`;

				collectFromProperty(
					property.items,
					itemValue,
					itemLabel,
					itemKey,
					section,
				);
			}

			if (value.length === 0) {
				entries.push({
					key,
					label,
					value: "[]",
					section,
				});
			}
			return;
		}

		entries.push({
			key,
			label,
			value,
			section,
		});
	};

	for (const [key, property] of Object.entries(schema.properties)) {
		if (!(key in content)) {
			continue;
		}

		const value = content[key];
		const label = property.title ?? key;
		collectFromProperty(property, value, label, key, property.ui?.section);
	}

	if (entries.length > 0) {
		return entries;
	}

	for (const [key, value] of Object.entries(content)) {
		entries.push({
			key,
			label: key,
			value,
			section: undefined,
		});
	}

	return entries;
}

export function groupReceiptEntriesBySection(
	entries: ElicitationReceiptEntry[],
): Array<{ section: string; entries: ElicitationReceiptEntry[] }> {
	const sections = new Map<string, ElicitationReceiptEntry[]>();
	for (const entry of entries) {
		const section = entry.section || "";
		const existing = sections.get(section) || [];
		existing.push(entry);
		sections.set(section, existing);
	}

	return Array.from(sections.entries()).map(([section, groupedEntries]) => ({
		section,
		entries: groupedEntries,
	}));
}
