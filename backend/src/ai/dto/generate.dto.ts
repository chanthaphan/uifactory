import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateUiDto {
  /** Natural-language description of the UI the user wants. */
  @IsString()
  @MinLength(1)
  prompt!: string;

  /** A sample of the query/API output (any JSON value), as a string. */
  @IsString()
  sample!: string;

  /** Optional label for the data, used in the generated heading. */
  @IsOptional()
  @IsString()
  queryName?: string;

  /** When set, refine this existing HTML according to the prompt instead of generating from scratch. */
  @IsOptional()
  @IsString()
  currentHtml?: string;

  /** Optional API/data guidance (method, endpoint shape, field meanings) to steer how the UI uses the data. */
  @IsOptional()
  @IsString()
  dataGuidance?: string;

  /** App-level build guidelines (AGENTS.md/CLAUDE.md style) to enforce conventions during generation. */
  @IsOptional()
  @IsString()
  guidelines?: string;
}
