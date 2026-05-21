import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { DataSourceType } from '../../execution/execution.types';

const TYPES: DataSourceType[] = ['REST', 'POSTGRES', 'SQLITE', 'MSGRAPH', 'AGENT'];

export class CreateDataSourceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(TYPES)
  type!: DataSourceType;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsIn(['shared', 'per-user'])
  authMode?: 'shared' | 'per-user';
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

  @IsOptional()
  @IsIn(['shared', 'per-user'])
  authMode?: 'shared' | 'per-user';
}
