import { authenticatedRoute } from '@/lib/auth-decorators';
import { COMPARE_MAX_MODELS } from '@/lib/constants';
import { getUserSettings, upsertUserSettings } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { validateSystemPromptSafe } from '@/lib/validations';

export const GET = authenticatedRoute(async (request, context, user) => {
  try {
    // Ensure user exists in our database (for OAuth users)
    if (!user.is_anonymous && user.email) {
    }

    const settings = await getUserSettings(user.id);
    const settingsData = settings?.settings || {};

    return Response.json(settingsData, { status: 200 });
  } catch (error) {
    console.error('Failed to get user settings:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Failed to get user settings',
    ).toResponse();
  }
});

export const PUT = authenticatedRoute(async (request, context, user) => {
  try {
    // Ensure user exists in our database (for OAuth users)
    if (!user.is_anonymous && user.email) {
    }

    const settingsUpdate = await request.json();

    // Validate that settings is an object
    if (typeof settingsUpdate !== 'object' || settingsUpdate === null) {
      return new ChatSDKError(
        'bad_request:api',
        'Settings must be an object',
      ).toResponse();
    }

    // Validate multi-model settings if provided
    if (settingsUpdate.compareModels) {
      if (!Array.isArray(settingsUpdate.compareModels)) {
        return new ChatSDKError(
          'bad_request:api',
          'compareModels must be an array of strings',
        ).toResponse();
      }

      // Validate each model ID is a string
      if (
        !settingsUpdate.compareModels.every((id: any) => typeof id === 'string')
      ) {
        return new ChatSDKError(
          'bad_request:api',
          'All model IDs in compareModels must be strings',
        ).toResponse();
      }

      // Validate max models limit
      if (settingsUpdate.compareModels.length > COMPARE_MAX_MODELS) {
        return new ChatSDKError(
          'bad_request:api',
          `Cannot select more than ${COMPARE_MAX_MODELS} models for comparison`,
        ).toResponse();
      }
    }

    await upsertUserSettings(user.id, settingsUpdate);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to update user settings:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Failed to update user settings',
    ).toResponse();
  }
});

export const PATCH = authenticatedRoute(async (request, context, user) => {
  try {
    // Ensure user exists in our database (for OAuth users)
    if (!user.is_anonymous && user.email) {
    }

    const settingsUpdate = await request.json();

    // Validate that settings is an object
    if (typeof settingsUpdate !== 'object' || settingsUpdate === null) {
      return new ChatSDKError(
        'bad_request:api',
        'Settings update must be an object',
      ).toResponse();
    }

    // Validate multi-model settings if provided
    if (settingsUpdate.compareModels) {
      if (!Array.isArray(settingsUpdate.compareModels)) {
        return new ChatSDKError(
          'bad_request:api',
          'compareModels must be an array of strings',
        ).toResponse();
      }

      // Validate each model ID is a string
      if (
        !settingsUpdate.compareModels.every((id: any) => typeof id === 'string')
      ) {
        return new ChatSDKError(
          'bad_request:api',
          'All model IDs in compareModels must be strings',
        ).toResponse();
      }

      // Validate max models limit
      if (settingsUpdate.compareModels.length > COMPARE_MAX_MODELS) {
        return new ChatSDKError(
          'bad_request:api',
          `Cannot select more than ${COMPARE_MAX_MODELS} models for comparison`,
        ).toResponse();
      }
    }

    // Validate system prompt if provided
    if (settingsUpdate.systemPrompt) {
      const validation = validateSystemPromptSafe(settingsUpdate.systemPrompt);
      if (!validation.success) {
        return new ChatSDKError(
          'bad_request:api',
          `Invalid system prompt: ${validation.error?.issues
            .map((i) => i.message)
            .join(', ')}`,
        ).toResponse();
      }
      // Use validated data
      settingsUpdate.systemPrompt = validation.data;
    }

    // Get current settings and merge with updates
    const currentSettings = await getUserSettings(user.id);
    const updatedSettings = {
      ...(currentSettings?.settings || {}),
      ...settingsUpdate,
    };

    await upsertUserSettings(user.id, updatedSettings);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to patch user settings:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Failed to update user settings',
    ).toResponse();
  }
});
