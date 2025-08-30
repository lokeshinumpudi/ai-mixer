import { gateway } from '@/lib/gateway';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { experimental_generateImage } from 'ai';
import { DEFAULT_IMAGE_MODEL } from '@/lib/constants';

export const imageDocumentHandler = createDocumentHandler<'image'>({
  kind: 'image',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { image } = await experimental_generateImage({
      model: gateway.imageModel(DEFAULT_IMAGE_MODEL),
      prompt: title,
      n: 1,
    });

    draftContent = image.base64;

    dataStream.write({
      type: 'data-imageDelta',
      data: image.base64,
      transient: true,
    });

    return draftContent;
  },
  onUpdateDocument: async ({ description, dataStream }) => {
    let draftContent = '';

    const { image } = await experimental_generateImage({
      model: gateway.imageModel(DEFAULT_IMAGE_MODEL),
      prompt: description,
      n: 1,
    });

    draftContent = image.base64;

    dataStream.write({
      type: 'data-imageDelta',
      data: image.base64,
      transient: true,
    });

    return draftContent;
  },
});
