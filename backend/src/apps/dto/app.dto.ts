import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** { html, queryId?, prompt?, sample? } */
  @IsObject()
  definition!: Record<string, unknown>;
}

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}
