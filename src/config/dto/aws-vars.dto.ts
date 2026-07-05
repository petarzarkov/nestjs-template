import { z } from 'zod';

export const awsVarsSchema = z.object({
  AWS_S3_BUCKET_NAME: z.string(),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

export type AWSConfigVars = z.infer<typeof awsVarsSchema>;
