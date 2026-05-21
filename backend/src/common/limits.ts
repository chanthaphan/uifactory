/** Platform guardrails. Each can be overridden by an env var for different deployments. */
export const LIMITS = {
  maxDeployedAppsPerUser: Number(process.env.MAX_DEPLOYED_APPS_PER_USER) || 20,
  maxChatInputWords: Number(process.env.MAX_CHAT_INPUT_WORDS) || 5000,
  /** Char budget for the chat transcript sent to the model (keeps the most recent turns). */
  chatHistoryCharBudget: Number(process.env.CHAT_HISTORY_CHAR_BUDGET) || 16000,
  // App size caps
  maxPagesPerApp: Number(process.env.MAX_PAGES_PER_APP) || 20,
  maxDataSourcesPerApp: Number(process.env.MAX_DATASOURCES_PER_APP) || 25,
  maxQueriesPerApp: Number(process.env.MAX_QUERIES_PER_APP) || 25,
  // Per-user, per-minute rate limits
  aiGenerateRatePerMin: Number(process.env.AI_GENERATE_RATE_PER_MIN) || 20,
  chatRatePerMin: Number(process.env.CHAT_RATE_PER_MIN) || 30,
  // Conversation retention
  maxConversationsPerUserApp: Number(process.env.MAX_CONVERSATIONS_PER_USER_APP) || 50,
  maxMessagesPerConversation: Number(process.env.MAX_MESSAGES_PER_CONVERSATION) || 200,
};

export function countWords(text: string): number {
  return (text.trim().match(/\S+/g) || []).length;
}
