import { IsOptional, IsString } from 'class-validator';

export class AWSConfigVars {
  @IsString()
  AWS_S3_BUCKET_NAME!: string;

  @IsString()
  AWS_REGION!: string;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;
}
