import { redirect } from 'next/navigation';

export default function AuthorityLoginRedirect() {
  redirect('/login');
}
