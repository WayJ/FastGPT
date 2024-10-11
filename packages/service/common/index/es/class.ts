import { Client } from 'es8';

import { TEXT_INDEX_TABLENAME, ElasticSearch_ADDRESS, ElasticSearch_TOKEN } from '../constants';
import type {
  DelTextIndexCtrlProps,
  TextRecallCtrlProps,
  RecallResponse,
  InsertTextIndexControllerProps
} from '../controller.d';
import { delay } from '@fastgpt/global/common/system/utils';
import { addLog } from '../../../common/system/log';

interface ElasticSearchHit<T> {
  _id: string;
  _source: T;
  _score: number;
}
// 假设 _source 的类型是如下结构
interface SourceType {
  collectionId: string;
}
export class ElasticSearchCtrl {
  constructor() {}
  getClient = async () => {
    if (!ElasticSearch_ADDRESS) {
      return Promise.reject('ElasticSearch_ADDRESS is not set');
    }
    if (global.esClient) return global.esClient;

    global.esClient = new Client({
      node: ElasticSearch_ADDRESS
    });

    addLog.info(`ElasticSearch connected`);

    return global.esClient;
  };
  init = async () => {
    const client = await this.getClient();

    // init db(ES index)
    try {
      const response = await client.indices.exist({
        index: TEXT_INDEX_TABLENAME
      });

      if (!response.body) {
        // response.body 返回索引是否存在的布尔值
        await client.indices.create({
          index: TEXT_INDEX_TABLENAME,
          mappings: {
            properties: {
              content: { type: 'text' },
              teamId: { type: 'keyword' },
              tmbId: { type: 'keyword' },
              datasetId: { type: 'keyword' },
              collectionId: { type: 'keyword' },
              createTime: { type: 'date', format: 'yyyy-MM-dd HH:mm:ss' }
            }
          }
        });
      }
    } catch (error) {}

    // // init collection and index
    // const { value: hasCollection } = await client.hasCollection({
    //   collection_name: DatasetVectorTableName
    // });
    // if (!hasCollection) {
    //   const result = await client.createCollection({
    //     collection_name: DatasetVectorTableName,
    //     description: 'Store dataset vector',
    //     enableDynamicField: true,
    //     fields: [
    //       {
    //         name: 'id',
    //         data_type: DataType.Int64,
    //         is_primary_key: true,
    //         autoID: true
    //       },
    //       {
    //         name: 'vector',
    //         data_type: DataType.FloatVector,
    //         dim: 1536
    //       },
    //       { name: 'teamId', data_type: DataType.VarChar, max_length: 64 },
    //       { name: 'datasetId', data_type: DataType.VarChar, max_length: 64 },
    //       { name: 'collectionId', data_type: DataType.VarChar, max_length: 64 },
    //       {
    //         name: 'createTime',
    //         data_type: DataType.Int64
    //       }
    //     ],
    //     index_params: [
    //       {
    //         field_name: 'vector',
    //         index_name: 'vector_HNSW',
    //         index_type: 'HNSW',
    //         metric_type: 'IP',
    //         params: { efConstruction: 32, M: 64 }
    //       },
    //       {
    //         field_name: 'teamId',
    //         index_type: 'Trie'
    //       },
    //       {
    //         field_name: 'datasetId',
    //         index_type: 'Trie'
    //       },
    //       {
    //         field_name: 'collectionId',
    //         index_type: 'Trie'
    //       },
    //       {
    //         field_name: 'createTime',
    //         index_type: 'STL_SORT'
    //       }
    //     ]
    //   });

    //   addLog.info(`Create milvus collection: `, result);
    // }

    // const { state: colLoadState } = await client.getLoadState({
    //   collection_name: DatasetVectorTableName
    // });

    // if (
    //   colLoadState === LoadState.LoadStateNotExist ||
    //   colLoadState === LoadState.LoadStateNotLoad
    // ) {
    //   await client.loadCollectionSync({
    //     collection_name: DatasetVectorTableName
    //   });
    //   addLog.info(`Milvus collection load success`);
    // }
  };

  insert = async (props: InsertTextIndexControllerProps): Promise<{ insertId: string }> => {
    const client = await this.getClient();
    const { teamId, datasetId, collectionId, text, indexId, retry = 3 } = props;

    try {
      const response = await client.index({
        index: TEXT_INDEX_TABLENAME,
        id: indexId,
        document: {
          content: text,
          teamId: String(teamId),
          datasetId: String(datasetId),
          collectionId: String(collectionId),
          createTime: Date.now()
        }
      });

      const insertId = response._id;

      return {
        insertId: insertId
      };
    } catch (error) {
      if (retry <= 0) {
        return Promise.reject(error);
      }
      await delay(500);
      return this.insert({
        ...props,
        retry: retry - 1
      });
    }
  };
  delete = async (props: DelTextIndexCtrlProps): Promise<any> => {
    const { teamId, retry = 2 } = props;
    const client = await this.getClient();

    const teamIdWhere = `(teamId=="${String(teamId)}")`;
    const where = await (() => {
      if ('id' in props && props.id) return `(id==${props.id})`;

      if ('datasetIds' in props && props.datasetIds) {
        const datasetIdWhere = `(datasetId in [${props.datasetIds
          .map((id) => `"${String(id)}"`)
          .join(',')}])`;

        if ('collectionIds' in props && props.collectionIds) {
          return `${datasetIdWhere} and (collectionId in [${props.collectionIds
            .map((id) => `"${String(id)}"`)
            .join(',')}])`;
        }

        return `${datasetIdWhere}`;
      }

      if ('idList' in props && Array.isArray(props.idList)) {
        if (props.idList.length === 0) return;
        return `(id in [${props.idList.map((id) => String(id)).join(',')}])`;
      }
      return Promise.reject('delete TextIndex: no where');
    })();

    if (!where) return;

    const concatWhere = `${teamIdWhere} and ${where}`;

    try {
      if ('id' in props && props.id) {
        // 按照 id 删除 doc
        await client.delete({
          index: TEXT_INDEX_TABLENAME,
          id: props.id
        });
      }
      if ('idList' in props && Array.isArray(props.idList) && props.idList.length > 0) {
        const query_ids = props.idList.map((id) => String(id));
        addLog.error(
          `Clear invalid index, clear ids: [${props.idList.map((id) => String(id)).join(',')}]`
        );
        // 按照 ids 删除 doc
        await client.deleteByQuery({
          index: TEXT_INDEX_TABLENAME,
          query: {
            bool: {
              filter: [
                {
                  terms: {
                    _id: query_ids
                  }
                }
              ]
            }
          }
        });
      }
      if ('datasetIds' in props && props.datasetIds && props.datasetIds.length > 0) {
        // 按照 datasetId 和 collectionId 删除 doc
        var query_terms = (() => {
          if ('datasetIds' in props && props.datasetIds && props.datasetIds.length > 0) {
            if ('collectionIds' in props && props.collectionIds && props.collectionIds.length > 0) {
              return {
                datasetId: props.datasetIds.map((id) => String(id)),
                collectionId: props.collectionIds.map((id) => String(id))
              };
            } else {
              return {
                datasetId: props.datasetIds.map((id) => String(id))
              };
            }
          }
        })();

        await client.deleteByQuery({
          index: TEXT_INDEX_TABLENAME,
          query: {
            bool: {
              filter: [
                {
                  terms: query_terms
                }
              ]
            }
          }
        });
      }
    } catch (error) {
      if (retry <= 0) {
        return Promise.reject(error);
      }
      await delay(500);
      return this.delete({
        ...props,
        retry: retry - 1
      });
    }
  };
  recall = async (props: TextRecallCtrlProps): Promise<RecallResponse> => {
    const client = await this.getClient();
    const {
      teamId,
      datasetIds,
      text,
      limit,
      // forbidCollectionIdList,
      filterCollectionIdList,
      retry = 2
    } = props;
    addLog.debug('查询参数：' + JSON.stringify(props));
    // // Forbid collection
    // const formatForbidCollectionIdList = (() => {
    //   if (!filterCollectionIdList) return forbidCollectionIdList;
    //   const list = forbidCollectionIdList
    //     .map((id) => String(id))
    //     .filter((id) => !filterCollectionIdList.includes(id));
    //   return list;
    // })();
    // const forbidColQuery =
    //   formatForbidCollectionIdList.length > 0
    //     ? `and (collectionId not in [${formatForbidCollectionIdList.map((id) => `"${id}"`).join(',')}])`
    //     : '';

    // filter collection id
    const formatFilterCollectionId = (() => {
      if (!filterCollectionIdList) return;
      return filterCollectionIdList.map((id) => String(id));
      // .filter((id) => !forbidCollectionIdList.includes(id));
    })();
    const collectionIdQuery = formatFilterCollectionId
      ? `and (collectionId in [${formatFilterCollectionId.map((id) => `"${id}"`)}])`
      : ``;
    // Empty data
    if (formatFilterCollectionId && formatFilterCollectionId.length === 0) {
      return { results: [] };
    }

    try {
      const query_body = {
        size: limit,
        query: {
          bool: {
            must: [
              {
                match: {
                  content: text // 查询content字段包含“搜索文本”的文档
                }
              },
              // {
              //   term: { teamId: String(teamId) }
              // },
              datasetIds && {
                terms: { datasetId: datasetIds.map((id) => String(id)) }
              },
              ...(formatFilterCollectionId && formatFilterCollectionId?.length > 0
                ? [
                    {
                      terms: { collectionId: formatFilterCollectionId.map((id) => String(id)) }
                    }
                  ]
                : [])
            ]
          }
        },
        sort: [
          {
            _score: {
              order: 'desc'
            }
          }
        ]
      };
      addLog.debug(JSON.stringify(query_body));
      const response = await client.search({
        index: TEXT_INDEX_TABLENAME,
        body: query_body
      });

      addLog.debug('查询结果：' + JSON.stringify(response.hits.hits));
      // 处理搜索结果
      const searchResults = response?.hits?.hits?.map((hit: ElasticSearchHit<SourceType>) => ({
        id: hit._id,
        collectionId: hit._source?.collectionId,
        score: hit._score
      })) as {
        score: number;
        id: string;
        collectionId: string;
      }[];

      return {
        results: searchResults
      };
    } catch (error) {
      if (retry <= 0) {
        return Promise.reject(error);
      }
      return this.recall({
        ...props,
        retry: retry - 1
      });
    }
  };

  getDataCountByTeamId = async (teamId: string) => {
    const client = await this.getClient();

    const response = await client.count({
      index: TEXT_INDEX_TABLENAME,
      body: {
        query: {
          term: { teamId: String(teamId) }
        }
      }
    });

    const total = response.body?.count as number;

    return total;
  };
  getDataCountByDatasetId = async (teamId: string, datasetId: string) => {
    const client = await this.getClient();

    const response = await client.count({
      index: TEXT_INDEX_TABLENAME,
      body: {
        query: {
          term: { teamId: String(teamId), datasetId: String(datasetId) }
        }
      }
    });

    const total = response.body?.count as number;

    return total;
  };

  existByDataId = async (dataId: string) => {
    const client = await this.getClient();

    const response = await client.exists({
      index: TEXT_INDEX_TABLENAME,
      id: dataId
    });
    // exists 查询直接返回一个布尔值，表示文档是否存在
    return response.body;
  };
  // getDataByTime = async (start: Date, end: Date) => {
  //   const client = await this.getClient();
  //   const startTimestamp = new Date(start).getTime();
  //   const endTimestamp = new Date(end).getTime();

  //   const result = await client.query({
  //     collection_name: DatasetVectorTableName,
  //     output_fields: ['id', 'teamId', 'datasetId'],
  //     filter: `(createTime >= ${startTimestamp}) and (createTime <= ${endTimestamp})`
  //   });

  //   const rows = result.data as {
  //     id: string;
  //     teamId: string;
  //     datasetId: string;
  //   }[];

  //   return rows.map((item) => ({
  //     id: String(item.id),
  //     teamId: item.teamId,
  //     datasetId: item.datasetId
  //   }));
  // };
}
