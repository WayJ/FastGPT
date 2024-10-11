import type { RecallItemType } from './type';

export type DeleteTextIndexProps = (
  | { id: string }
  | { datasetIds: string[]; collectionIds?: string[] }
  | { idList: string[] }
) & {
  teamId: string;
};
export type DelTextIndexCtrlProps = DeleteTextIndexProps & {
  retry?: number;
};

export type InsertIndexProps = {
  teamId: string;
  datasetId: string;
  collectionId: string;
  indexId: string;
};
export type InsertTextIndexControllerProps = InsertIndexProps & {
  text: string;
  indexId: string;
  retry?: number;
};

export type RecallProps = {
  teamId: string;
  datasetIds: string[];

  // forbidCollectionIdList: string[];
  filterCollectionIdList?: string[];
};
export type TextRecallCtrlProps = RecallProps & {
  text: string;
  limit: number;
  retry?: number;
};
export type RecallResponse = {
  results: RecallItemType[];
};
