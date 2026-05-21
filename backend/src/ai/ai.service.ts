import { Injectable, Logger } from '@nestjs/common';
import { GenerateUiDto } from './dto/generate.dto';
import { buildFallbackHtml } from './fallback-generator';
import { AiProviderName, defaultModel, detectProviderName, resolveProvider } from './ai.providers';

export interface GenerateUiResult {
  html: string;
  source: 'ai' | 'fallback';
  provider?: AiProviderName;
  model?: string;
  note?: string;
}

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
- Keep it accessible and self-contained; never reference external CSS/JS other than the allowed Chart.js CDN.

INTERACTIVITY (use only when the request needs it):
- A global \`window.UIFactory\` bridge is available at runtime. Prefer it over calling fetch() directly:
  - \`await UIFactory.runAction(name, params)\` -> runs a named server query/action (filters, search, detail lookups, or write-back like create/update/delete). Resolves to { data, meta }.
  - \`await UIFactory.refresh()\` -> re-runs the page's primary query; the result is also pushed to any onData handler.
  - \`UIFactory.onData(cb)\` -> cb(data) fires with the latest data (and immediately with the initial window.APP_DATA).
  - \`UIFactory.navigate(slug)\` -> open another page of the app.
  - \`await UIFactory.readFile(fileOrInput)\` -> read a user-selected file; resolves to { name, type, size, dataUrl, text } (text only for text-like files). Use it to build "browse a file then submit it to an action" flows.
- Forms that create/update/delete should call \`UIFactory.runAction(...)\` then \`UIFactory.refresh()\`.
- For file uploads: render an \`<input type="file">\`, call \`UIFactory.readFile(input.files[0])\`, then pass the result (e.g. { filename, contentBase64 } from dataUrl, or text) to \`UIFactory.runAction(...)\`.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  isConfigured(): boolean {
    return resolveProvider() !== null;
  }

  status() {
    const name = detectProviderName();
    return {
      configured: this.isConfigured(),
      provider: name,
      model: name ? defaultModel(name) : null,
    };
  }

  async generateUi(dto: GenerateUiDto): Promise<GenerateUiResult> {
    const truncatedSample = this.truncateSample(dto.sample);
    const provider = resolveProvider();

    if (!provider) {
      return {
        html: buildFallbackHtml(dto.prompt, truncatedSample, dto.queryName),
        source: 'fallback',
        note: 'No AI provider is configured, so a built-in template was used. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or the AZURE_OPENAI_* variables to use an LLM.',
      };
    }

    const refine = dto.currentHtml && dto.currentHtml.trim().length > 0;
    const guidance = dto.dataGuidance?.trim()
      ? ['', 'Data / API guidance (how to interpret and use this data):', dto.dataGuidance.trim()]
      : [];
    const userContent = (
      refine
        ? [
            `Apply this change to the existing app page and return the COMPLETE updated HTML document: ${dto.prompt}`,
            dto.queryName ? `Data label: ${dto.queryName}` : '',
            ...guidance,
            '',
            'Current HTML:',
            '```html',
            dto.currentHtml!.slice(0, 60000),
            '```',
            '',
            'The data shape (window.APP_DATA) is:',
            '```json',
            truncatedSample,
            '```',
          ]
        : [
            `User request: ${dto.prompt}`,
            dto.queryName ? `Data label: ${dto.queryName}` : '',
            ...guidance,
            '',
            'Here is a sample of the data. window.APP_DATA will have this exact shape at runtime:',
            '```json',
            truncatedSample,
            '```',
          ]
    )
      .filter(Boolean)
      .join('\n');

    try {
      const text = await provider.generate(SYSTEM_PROMPT, userContent);
      const html = this.stripFences(text);
      if (!html.toLowerCase().includes('<')) {
        throw new Error('Model did not return HTML');
      }
      return { html, source: 'ai', provider: provider.name, model: provider.model };
    } catch (err) {
      this.logger.warn(`${provider.name} generation failed, using fallback: ${(err as Error).message}`);
      return {
        html: buildFallbackHtml(dto.prompt, truncatedSample, dto.queryName),
        source: 'fallback',
        note: `${provider.name} request failed (${(err as Error).message}); used the built-in template instead.`,
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
