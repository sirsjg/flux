/** Plain text tool result. */
export const textResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
});

/** Error tool result (bypasses output schema validation). */
export const errorResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  isError: true,
});

/** Structured tool result: JSON text content plus structuredContent. */
export const structuredResult = <T extends Record<string, unknown>>(structured: T, text?: string) => ({
  content: [{ type: 'text' as const, text: text ?? JSON.stringify(structured, null, 2) }],
  structuredContent: structured,
});
