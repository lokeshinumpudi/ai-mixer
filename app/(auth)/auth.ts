import { DUMMY_PASSWORD } from '@/lib/constants';
import { getUser, getUserType } from '@/lib/db/queries';
import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

export type UserType = 'free' | 'pro';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        console.log(
          `🔐 AUTH: authorize() called for email: ${email?.substring(0, 3)}***`,
        );

        const users = await getUser(email);
        console.log('🔐 AUTH: Found users count:', users.length);

        if (users.length === 0) {
          console.log('🔐 AUTH: No user found, doing dummy password compare');
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;
        console.log('🔐 AUTH: User found:', {
          id: user.id,
          hasPassword: !!user.password,
        });

        if (!user.password) {
          console.log('🔐 AUTH: User has no password, doing dummy compare');
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);
        console.log('🔐 AUTH: Password match result:', passwordsMatch);

        if (!passwordsMatch) {
          console.log('🔐 AUTH: Password mismatch, rejecting');
          return null;
        }

        // Check subscription status to determine user type
        const userType = await getUserType(user.id);
        console.log('🔐 AUTH: User type determined:', userType);
        return { ...user, type: userType };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        // Refresh user type on each session to check for subscription changes
        session.user.type = await getUserType(token.id);
      }

      return session;
    },
  },
});
