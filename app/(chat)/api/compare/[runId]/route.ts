import { authenticatedRoute } from '@/lib/auth-decorators';
import { getCompareRun } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const GET = authenticatedRoute(async (request, context, user) => {
  if (!context.params) {
    return new ChatSDKError(
      'bad_request:api',
      'Run ID is required',
    ).toResponse();
  }

  try {
    const { runId } = await context.params;

    if (!runId) {
      return new ChatSDKError(
        'bad_request:api',
        'Run ID is required',
      ).toResponse();
    }

    const { run, results } = await getCompareRun({ runId });

    // Verify user owns this run
    if (run.userId !== user.id) {
      return new ChatSDKError(
        'forbidden:compare',
        'Access denied',
      ).toResponse();
    }

    return Response.json({
      run,
      results,
    });
  } catch (error) {
    console.error('Get compare run error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to get compare run',
    ).toResponse();
  }
});
