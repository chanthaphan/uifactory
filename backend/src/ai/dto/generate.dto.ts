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
}
