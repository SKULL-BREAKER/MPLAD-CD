'use client';
import GoogleLoginCard from '../../components/GoogleLoginCard';

export default function AuthorityLogin() {
  return (
    <GoogleLoginCard
      expectedRole="OFFICER"
      title="Authority Secure Portal"
      subtitle="For District Officers & Administrators — Official Google accounts only"
      accentColor="#2563EB"
    />
  );
}
