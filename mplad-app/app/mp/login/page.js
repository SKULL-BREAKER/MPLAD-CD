'use client';
import GoogleLoginCard from '../../components/GoogleLoginCard';

export default function MPLogin() {
  return (
    <GoogleLoginCard
      expectedRole="MP"
      title="MP Secure Portal"
      subtitle="For registered Members of Parliament — Lok Sabha & Rajya Sabha"
      accentColor="#10B981"
    />
  );
}
