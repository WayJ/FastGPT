import { rebuildDataIndex2Dataset } from '@/service/core/dataset/data/controller';
import { pushGenerateVectorUsage } from '@/service/support/wallet/usage/push';
import { FixIndexDatasetDataProps } from '@fastgpt/global/core/dataset/controller';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { authDatasetData } from '@fastgpt/service/support/permission/dataset/auth';
import { ApiRequestProps } from '@fastgpt/service/type/next';
import { MongoDatasetData } from '@fastgpt/service/core/dataset/data/schema';

async function handler(req: ApiRequestProps<FixIndexDatasetDataProps>) {
  const { dataId } = req.body;

  // auth data permission
  const {
    collection: {
      datasetId: { vectorModel }
    },
    teamId,
    tmbId
  } = await authDatasetData({
    req,
    authToken: true,
    authApiKey: true,
    dataId,
    per: WritePermissionVal
  });

  const isSuccess = await rebuildDataIndex2Dataset({
    dataId,
    model: vectorModel
  });
  // pushGenerateVectorUsage({
  //   teamId,
  //   tmbId,
  //   tokens,
  //   model: vectorModel
  // });
  if (isSuccess) {
    return 'success';
  } else {
    return 'failed';
  }
}

export default NextAPI(handler);
