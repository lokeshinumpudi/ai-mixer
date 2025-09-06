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

    // Insert new cache entry with expiration
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error } = await supabase.from('ModelCache').insert({
      models,
      lastRefreshedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache refreshed successfully',
        models_cached: models.length,
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
