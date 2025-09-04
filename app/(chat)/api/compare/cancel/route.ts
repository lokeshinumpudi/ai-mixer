import { authenticatedRoute } from '@/lib/auth-decorators';
import { cancelStream } from '@/lib/cache/stream-registry';
import {
  cancelCompareResult,
  cancelCompareRun,
  getCompareRun,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { compareCancelRequestSchema } from '../schema';

export const POST = authenticatedRoute(async (request, _context, user) => {
  let requestBody: any;

  try {
    const json = await request.json();
    requestBody = compareCancelRequestSchema.parse(json);
  } catch (_) {
    return new ChatSDKError(
      'bad_request:api',
      'Invalid request body',
    ).toResponse();
  }

  try {
    const { runId, modelId } = requestBody;

    // Verify user owns this compare run
    const { run } = await getCompareRun({ runId });
    if (run.userId !== user.id) {
      return new ChatSDKError(
        'forbidden:compare',
        'Access denied',
      ).toResponse();
    }

    // Cancel active streams
    const canceledCount = cancelStream(runId, modelId);

    if (modelId) {
      // Cancel specific model result
      await cancelCompareResult({ runId, modelId });

      return Response.json({
        success: true,
        message: `Canceled model ${modelId}`,
        canceledStreams: canceledCount,
      });
    } else {
      // Cancel entire run
      await cancelCompareRun({ runId });

      return Response.json({
        success: true,
        message: 'Canceled compare run',
        canceledStreams: canceledCount,
      });
    }
  } catch (error) {
    console.error('Compare cancel error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to cancel compare run',
    ).toResponse();
  }
});
