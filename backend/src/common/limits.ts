/** Platform guardrails. Each can be overridden by an env var for different deployments. */
export const LIMITS = {
  maxDeployedAppsPerUser: Number(process.env.MAX_DEPLOYED_APPS_PER_USER) || 20,
  maxChatInputWords: Number(process.env.MAX_CHAT_INPUT_WORDS) || 5000,
  /** Char budget for the chat transcript sent to the model (keeps the most recent turns). */
  chatHistoryCharBudget: Number(process.env.CHAT_HISTORY_CHAR_BUDGET) || 16000,
};

export function countWords(text: string): number {
  return (text.trim().match(/\S+/g) || []).length;
}
