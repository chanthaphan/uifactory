import { IsArray, IsIn, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  aiConfig?: Record<string, unknown>;
}

export class ShareMemberDto {
  @IsString()
  email!: string;

  @IsIn(['editor', 'viewer'])
  role!: 'editor' | 'viewer';
}

export class SharingDto {
  @IsIn(['private', 'org', 'public'])
  visibility!: 'private' | 'org' | 'public';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShareMemberDto)
  members?: ShareMemberDto[];
}

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  content!: string;
}

export class ChatDto {
  @IsOptional()
  @IsString()
  pageId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}
