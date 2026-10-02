import { redirect } from 'next/navigation';

export default function MPLoginRedirect() {
  redirect('/login');
}
