import GoogleProvider from 'next-auth/providers/google';
import db from './db';

async function resolveRole(email) {
  const normalised = email.toLowerCase().trim();

  // 0. Superadmin override for the developer accounts
  const devEmails = ['31skullbreaker@gmail.com', 'nanthakumar7750@gmail.com', 'sreedharnandha9442@gmail.com', 'sreedharnandhu17@gmail.com'];
  if (devEmails.includes(normalised)) {
    return { role: 'ADMIN', name: 'System Administrator', district_id: 'ALL' };
  }

  // 1. Check registered users (officers, admins)
  const user = await db.user.findFirst({
    where: { id: { contains: normalised.split('@')[0] } },
    select: { id: true, name: true, role: true, district_id: true },
  }).catch(() => null);

  if (user) return { role: user.role, name: user.name, district_id: user.district_id };

  // 2. Check MPs table by matching email patterns
  const mp = await db.mp.findFirst({
    where: { OR: [{ email: normalised }, { name: { contains: normalised.split('@')[0] } }] },
    select: { id: true, name: true, constituency: true, state: true },
  }).catch(() => null);

  if (mp) return { role: 'MP', name: mp.name, constituency: mp.constituency, state: mp.state, mp_id: mp.id };

  // 3. No match — deny
  return null;
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false;
      const roleData = await resolveRole(user.email);
      if (!roleData) return `/login?error=not_registered&email=${encodeURIComponent(user.email)}`;
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google') {
        const roleData = await resolveRole(token.email);
        if (roleData) {
          token.role = roleData.role;
          token.district_id = roleData.district_id || null;
          token.mp_id = roleData.mp_id || null;
          token.constituency = roleData.constituency || null;
          token.state = roleData.state || null;
          token.mplad_name = roleData.name || token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role || null;
      session.user.district_id = token.district_id || null;
      session.user.mp_id = token.mp_id || null;
      session.user.constituency = token.constituency || null;
      session.user.state = token.state || null;
      session.user.mplad_name = token.mplad_name || session.user.name;
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};
