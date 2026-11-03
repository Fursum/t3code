import type { OrchestrationV2ProviderTurn } from "@t3tools/contracts";
import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";

export function formatContextWindowTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "0";
  }
  if (value < 1_000) {
    return `${Math.round(value)}`;
  }
  if (value < 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (value < 999_500) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function formatContextWindowCost(cost: {
  readonly amount: number;
  readonly currency: string;
}): string {
  const fractionDigits = Math.abs(cost.amount) > 0 && Math.abs(cost.amount) < 0.01 ? 4 : 2;
  return `${cost.currency} ${cost.amount.toFixed(fractionDigits)}`;
}

/** Send-button tooltip lines. Thread totals come from each turn's record, so they survive compaction and session restarts. */
export function threadUsageSummary(
  snapshot: ContextWindowSnapshot | null,
  turns: ReadonlyArray<Pick<OrchestrationV2ProviderTurn, "turnTokenUsage">>,
): string | null {
  const lines: string[] = [];
  if (snapshot !== null) {
    const used = formatContextWindowTokens(snapshot.usedTokens);
    const max = snapshot.maxTokens != null && snapshot.maxTokens > 0 ? snapshot.maxTokens : null;
    const percent =
      snapshot.usedPercentage === null ? "" : ` (${Math.round(snapshot.usedPercentage)}%)`;
    lines.push(
      max === null
        ? `Context ${used}`
        : `Context ${used} / ${formatContextWindowTokens(max)}${percent}`,
    );
  }
  let processed = 0;
  // ponytail: assumes one currency per thread, since only Copilot reports a turn cost today.
  let costAmount = 0;
  let currency: string | undefined;
  for (const { turnTokenUsage: usage } of turns) {
    if (usage === undefined || usage.localCommand === true) continue;
    processed +=
      (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.otherUsage?.inputTokens ?? 0) +
      (usage.otherUsage?.outputTokens ?? 0);
    if (usage.cost !== undefined) {
      costAmount += usage.cost.amount;
      currency = usage.cost.currency;
    }
  }
  const thread = [
    ...(processed > 0 ? [`${formatContextWindowTokens(processed)} tokens`] : []),
    ...(currency === undefined ? [] : [formatContextWindowCost({ amount: costAmount, currency })]),
  ];
  if (thread.length > 0) lines.push(`Thread ${thread.join(" · ")}`);
  return lines.length > 0 ? lines.join("\n") : null;
}
