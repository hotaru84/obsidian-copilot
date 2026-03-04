export interface CustomCommandOption {
	id: string;
	label: string;
	value: string;
	type: "agent" | "prompt";
	description: string;
	hint?: string | null;
	agentName?: string;
}
