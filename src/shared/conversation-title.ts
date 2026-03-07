import type {
	ChatMessage,
	MessageContent,
} from "../domain/models/chat-message";

const MENTION_PATTERN = /@folder\[\[.*?\]\]|@?\[\[.*?\]\]/g;

/**
 * Derive a conversation title from the first user message.
 * Matches the same mention-stripping behavior used for chat tab titles.
 */
export function extractConversationTitle(
	messages: ChatMessage[],
	fallback = "Copilot chat",
): string {
	const firstUserMessage = messages.find(
		(message) => message.role === "user",
	);
	if (!firstUserMessage) {
		return fallback;
	}

	const textContent = firstUserMessage.content.find(
		(
			content,
		): content is Extract<
			MessageContent,
			{ type: "text" | "text_with_context" }
		> => content.type === "text" || content.type === "text_with_context",
	);

	if (!textContent) {
		return fallback;
	}

	const title = textContent.text
		.replace(MENTION_PATTERN, "")
		.split("\n")[0]
		.trim();
	return title || fallback;
}
