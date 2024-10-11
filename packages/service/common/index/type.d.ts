// import type { Pool } from 'pg';
// import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { Client } from '@elastic/elasticsearch';

declare global {
  var esClient: Client | null;
}

export type RecallItemType = {
  id: string;
  collectionId: string;
  score: number;
};
