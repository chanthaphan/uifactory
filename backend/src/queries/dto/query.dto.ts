import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateQueryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  dataSourceId!: string;

  @IsObject()
  config!: Record<string, unknown>;
}

export class UpdateQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  dataSourceId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** Run an ad-hoc query against a saved data source without persisting it. */
export class RunInlineDto {
  @IsString()
  @MinLength(1)
  dataSourceId!: string;

  @IsObject()
  config!: Record<string, unknown>;
}
