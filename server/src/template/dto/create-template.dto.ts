import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  contentTspl?: string; // 新增：TSPL 模板

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  productCode?: string;
}
