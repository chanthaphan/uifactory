import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GenerateUiDto } from './dto/generate.dto';
import { buildFallbackHtml } from './fallback-generator';

export interface GenerateUiResult {
  html: string;
  source: 'claude' | 'fallback';
  model?: string;
  note?: string;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are UIFactory's UI generation engine. You turn a sample of API/database output into a single, self-contained HTML document that renders a polished business-application screen.

STRICT OUTPUT RULES:
- Output ONLY raw HTML. Start with <!doctype html>. No markdown fences, no commentary.
- The runtime data is provided as a global variable \`window.APP_DATA\` (already-parsed JSON with the same shape as the sample). DO NOT hardcode the sample values into the markup — always read from window.APP_DATA so the UI updates when the data changes.
- Guard for missing data: if window.APP_DATA is undefined/null/empty, render a friendly empty state.
- Use only an inline <style> block and vanilla JavaScript in a <script> tag. The ONLY external resource you may load is Chart.js from https://cdn.jsdelivr.net/npm/chart.js when a chart genuinely helps.
- Design: clean, modern, responsive, light theme, system font stack, generous spacing, a clear page heading and subtle card/table styling.

CONTENT GUIDANCE:
- Array of objects -> a data table (with header row, zebra striping, and a text filter box) and/or summary cards. Add a chart if there is an obvious numeric/categorical breakdown.
- Single object -> a labelled detail/summary view.
- Honor the user's request about what to emphasize, which fields to show, and the layout.
- Keep it accessible and self-contained; never reference external CSS/JS other than the allowed Chart.js CDN.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  status() {
    return {
      configured: this.isConfigured(),
      model: DEFAULT_MODEL,
      provider: 'anthropic',
    };
  }

  async generateUi(dto: GenerateUiDto): Promise<GenerateUiResult> {
    const truncatedSample = this.truncateSample(dto.sample);

    if (!this.isConfigured()) {
      return {
        html: buildFallbackHtml(dto.prompt, truncatedSample, dto.queryName),
        source: 'fallback',
        note: 'ANTHROPIC_API_KEY is not set, so a built-in template was used instead of Claude.',
      };
    }

    try {
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      });

      const userContent = [
        `User request: ${dto.prompt}`,
        dto.queryName ? `Data label: ${dto.queryName}` : '',
        '',
        'Here is a sample of the data. window.APP_DATA will have this exact shape at runtime:',
        '```json',
        truncatedSample,
        '```',
      ]
        .filter(Boolean)
        .join('\n');

      const message = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const html = this.stripFences(text);
      if (!html.toLowerCase().includes('<')) {
        throw new Error('Model did not return HTML');
      }

      return { html, source: 'claude', model: DEFAULT_MODEL };
    } catch (err) {
      this.logger.warn(`Claude generation failed, using fallback: ${(err as Error).message}`);
      return {
        html: buildFallbackHtml(dto.prompt, truncatedSample, dto.queryName),
        source: 'fallback',
        note: `Claude request failed (${(err as Error).message}); used the built-in template instead.`,
      };
    }
  }

  /** Remove ```html ... ``` fences if the model wrapped its output. */
  private stripFences(text: string): string {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) return fenceMatch[1].trim();
    return trimmed;
  }

  /** Cap the sample size sent to the model: keep first 20 array items, stringify nicely. */
  private truncateSample(sample: string): string {
    try {
      const parsed = JSON.parse(sample);
      if (Array.isArray(parsed) && parsed.length > 20) {
        const trimmed = parsed.slice(0, 20);
        return JSON.stringify(
          { __note: `showing first 20 of ${parsed.length} items`, items: trimmed },
          null,
          2,
        );
      }
      return JSON.stringify(parsed, null, 2);
    } catch {
      return sample.slice(0, 8000);
    }
  }
}
