import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="text-center py-24">
      <h1 className="text-4xl font-bold mb-4">Page not found</h1>
      <p className="text-slate-400 mb-8">The page you are looking for does not exist.</p>
      <Link to="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm">
        Return to Overview
      </Link>
    </div>
  );
}
