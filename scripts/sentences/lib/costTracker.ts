interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
}

// USD per 1M tokens. These are indicative defaults and drift as OpenAI
// updates pricing — override per run with OPENAI_PRICE_INPUT_PER_M /
// OPENAI_PRICE_OUTPUT_PER_M (see lib/config.ts) rather than trusting this
// table blindly before a large paid run.
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-5-mini': { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  'gpt-5-nano': { inputPerMillion: 0.05, outputPerMillion: 0.4 },
  'gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  'gpt-5.6-luna': { inputPerMillion: 0.2, outputPerMillion: 1.2 },
  'gpt-5.6-terra': { inputPerMillion: 2.0, outputPerMillion: 12.0 },
  'gpt-5.6-sol': { inputPerMillion: 5.0, outputPerMillion: 30.0 },
}

export class CostTracker {
  private promptTokens = 0
  private completionTokens = 0
  private pricing: ModelPricing | undefined

  constructor(
    private model: string,
    overrides?: { inputPerMillion?: number; outputPerMillion?: number }
  ) {
    const base = DEFAULT_PRICING[model]
    if (overrides?.inputPerMillion !== undefined && overrides?.outputPerMillion !== undefined) {
      this.pricing = { inputPerMillion: overrides.inputPerMillion, outputPerMillion: overrides.outputPerMillion }
    } else {
      this.pricing = base
    }
  }

  add(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): void {
    if (!usage) return
    this.promptTokens += usage.prompt_tokens ?? 0
    this.completionTokens += usage.completion_tokens ?? 0
  }

  get totalCostUsd(): number | null {
    if (!this.pricing) return null
    return (
      (this.promptTokens / 1_000_000) * this.pricing.inputPerMillion +
      (this.completionTokens / 1_000_000) * this.pricing.outputPerMillion
    )
  }

  summary(): string {
    const cost = this.totalCostUsd
    const tokenPart = `${this.promptTokens} in / ${this.completionTokens} out tokens`
    if (cost === null) {
      return `${tokenPart} — no pricing known for "${this.model}", cost not estimated`
    }
    return `${tokenPart} — est. cost $${cost.toFixed(4)}`
  }
}
