import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { DataSourceType } from '../../execution/execution.types';

const TYPES: DataSourceType[] = ['REST', 'POSTGRES', 'SQLITE', 'MSGRAPH'];

export class CreateDataSourceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(TYPES)
  type!: DataSourceType;

  @IsObject()
  config!: Record<string, unknown>;
}

export class UpdateDataSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: DataSourceType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
