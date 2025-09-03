export type Database = {
  public: {
    Tables: {
      // We'll extend this as needed, but for now we're using our existing Drizzle schema
      // Supabase auth will handle the auth.users table automatically
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type UserType = 'free' | 'pro' | 'anonymous';

// Custom user metadata structure for Supabase Auth
export interface UserMetadata {
  user_type: UserType;
  created_via: 'google' | 'anonymous';
}

// Extended user type combining Supabase Auth user with our metadata
export interface AppUser {
  id: string;
  email?: string;
  user_metadata: UserMetadata;
  is_anonymous?: boolean;
}
