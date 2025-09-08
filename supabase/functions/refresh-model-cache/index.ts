// Type declarations for Deno runtime in Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

/**
 * Deno-compatible imports for Supabase Edge Functions
 * These work at runtime but TypeScript doesn't recognize them
 */
/* eslint-disable */
// @ts-ignore: ESM imports work in Deno runtime
import { createGatewayProvider } from 'https://esm.sh/@ai-sdk/gateway@1.0.12';
// @ts-ignore: ESM imports work in Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      },
    );

    const gateway = createGatewayProvider({
      apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '',
    });
    const { models } = await gateway.getAvailableModels();

    // Upsert strategy: Update existing cache or create new one
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const now = new Date().toISOString();

    // First, try to update existing active cache
    const { data: existingCache } = await supabase
      .from('ModelCache')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single();

    let result: any;
    if (existingCache) {
      // Update existing cache entry
      result = await supabase
        .from('ModelCache')
        .update({
          models,
          lastRefreshedAt: now,
          expiresAt: expiresAt.toISOString(),
        })
        .eq('id', existingCache.id);
    } else {
      // Create new cache entry if none exists
      result = await supabase.from('ModelCache').insert({
        models,
        lastRefreshedAt: now,
        expiresAt: expiresAt.toISOString(),
        status: 'active',
      });
    }

    if (result.error) {
      throw result.error;
    }

    // Cleanup: Remove expired cache entries to prevent database bloat
    const { error: cleanupError } = await supabase
      .from('ModelCache')
      .delete()
      .lt('expiresAt', now);

    // Don't fail the entire operation if cleanup fails
    if (cleanupError) {
      console.warn('Cache cleanup failed:', cleanupError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: existingCache
          ? 'Cache updated successfully'
          : 'Cache created successfully',
        models_cached: models.length,
        operation: existingCache ? 'update' : 'insert',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
