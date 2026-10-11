import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SESv2Client } from '@aws-sdk/client-sesv2';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const ses = new SESv2Client({});
