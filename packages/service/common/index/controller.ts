/* text index crud */

import { getVectorsByText } from '../../core/ai/embedding';
import { InsertIndexProps } from './controller.d';
// import { VectorModelItemType } from '@fastgpt/global/core/ai/model.d';
import { ElasticSearch_ADDRESS } from './constants';
import { ElasticSearchCtrl } from './es/class';
// import { ElasticSearch_ADDRESS } from './constants';

const getIndexStoreObj = () => {
  if (ElasticSearch_ADDRESS) return new ElasticSearchCtrl();
  // else if (MILVUS_ADDRESS) return new ElasticSearchCtrl();
  // else if (ElasticSearch_ADDRESS) return new ElasticSearchCtrl();
  else return new ElasticSearchCtrl();
};

const IndexStore = getIndexStoreObj();

export const initIndexStore = IndexStore.init;
export const deleteIndexByDatasetData = IndexStore.delete;
export const recallDatasetDataIndex = IndexStore.recall;
// export const getIndexDataByTime = IndexStore.getDataCountByTeamId;
export const getIndexCountByTeamId = IndexStore.getDataCountByTeamId;
export const getIndexCountByDatasetId = IndexStore.getDataCountByDatasetId;
export const existByDataId = IndexStore.existByDataId;

export const insertTextIndexByData = async ({
  // model,
  query,
  indexId,
  ...props
}: InsertIndexProps & {
  query: string;
  // model: VectorModelItemType;
}) => {
  // const { vectors, tokens } = await getVectorsByText({
  //   model,
  //   input: query,
  //   type: 'db'
  // });
  const { insertId } = await IndexStore.insert({
    ...props,
    text: query,
    indexId: indexId
  });

  return {
    insertId
  };
};
