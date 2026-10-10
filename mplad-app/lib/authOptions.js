import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import db from './db';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password)
          throw new Error('MISSING_FIELDS');

        const email = credentials.email.toLowerCase().trim();

        const user = await db.user.findFirst({
          where: { email },
          select: { id: true, name: true, role: true, district_id: true, password_hash: true, email: true },
        }).catch(() => null);

        if (!user) throw new Error('USER_NOT_FOUND');
        if (!user.password_hash) throw new Error('NO_PASSWORD');

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) throw new Error('WRONG_PASSWORD');

        return {
          id:          user.id,
          name:        user.name,
          email:       user.email,
          role:        user.role,
          district_id: user.district_id,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, copy role into token
      if (user) {
        token.role        = user.role;
        token.district_id = user.district_id || null;
        token.user_id     = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role        = token.role        || null;
      session.user.district_id = token.district_id || null;
      session.user.id          = token.user_id     || null;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60,
  },
  secret:    process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'mplads-dev-only-secret-do-not-use-in-production-2026',
  trustHost: true,
};
