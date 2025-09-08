import Form from 'next/form';

import { createClient } from '@/lib/supabase/server';

export const SignOutForm = () => {
  return (
    <Form
      className="w-full"
      action={async () => {
        'use server';
        // Clear Supabase session first to prevent auto-restoring previous user
        try {
          const supabase = await createClient();
          await supabase.auth.signOut();
        } catch (e) {
          console.error('Supabase server signOut failed', e);
        }
      }}
    >
      <button
        type="submit"
        className="w-full text-left px-1 py-0.5 text-red-500"
      >
        Sign out
      </button>
    </Form>
  );
};
