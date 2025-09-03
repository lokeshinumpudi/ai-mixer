import { authenticatedRoute } from '@/lib/auth-decorators';
import {
  createOAuthUserIfNotExists,
  getUserSettings,
  upsertUserSettings,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const GET = authenticatedRoute(async (request, context, user) => {
  try {
    // Ensure user exists in our database (for OAuth users)
    if (!user.is_anonymous && user.email) {
      await createOAuthUserIfNotExists(user.id, user.email);
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
      await createOAuthUserIfNotExists(user.id, user.email);
    }

    const settingsUpdate = await request.json();

    // Validate that settings is an object
    if (typeof settingsUpdate !== 'object' || settingsUpdate === null) {
      return new ChatSDKError(
        'bad_request:api',
        'Settings must be an object',
      ).toResponse();
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
      await createOAuthUserIfNotExists(user.id, user.email);
    }

    const settingsUpdate = await request.json();

    // Validate that settings is an object
    if (typeof settingsUpdate !== 'object' || settingsUpdate === null) {
      return new ChatSDKError(
        'bad_request:api',
        'Settings update must be an object',
      ).toResponse();
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
