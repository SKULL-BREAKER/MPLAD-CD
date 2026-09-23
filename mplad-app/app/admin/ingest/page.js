'use client';

import { useState } from 'react';

export default function AdminIngestPage() {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('dryrun'); // dryrun or commit
  const [adminToken, setAdminToken] = useState('test-admin-token'); // Easy testing

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setReport(null);
    setError(null);
    setMode('dryrun');
  };

  const handleUpload = async (uploadMode) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setMode(uploadMode);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/ingest/csv?mode=${uploadMode}`, {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
        },
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OMS CSV Data Ingest</h1>
      
      <div className="mb-6 p-4 border rounded shadow-sm bg-white">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Admin Token</label>
          <input 
            type="password" 
            value={adminToken} 
            onChange={e => setAdminToken(e.target.value)} 
            className="border p-2 rounded w-64"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select CSV File</label>
          <input type="file" accept=".csv" onChange={handleFileChange} />
        </div>

        <button 
          onClick={() => handleUpload('dryrun')}
          disabled={!file || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading && mode === 'dryrun' ? 'Processing...' : 'Dry Run (Validate & Map)'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded">
          <strong>Error: </strong> {error}
        </div>
      )}

      {report && (
        <div className="p-4 border rounded shadow-sm bg-white">
          <h2 className="text-xl font-semibold mb-4">
            {mode === 'dryrun' ? 'Validation Report (Dry Run)' : 'Import Summary'}
          </h2>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 border rounded text-center">
              <div className="text-sm text-gray-500">Total Rows</div>
              <div className="text-2xl font-bold">{report.total}</div>
            </div>
            <div className="p-3 bg-green-50 border rounded text-center">
              <div className="text-sm text-green-700">Valid (Accepted)</div>
              <div className="text-2xl font-bold text-green-600">{report.accepted}</div>
            </div>
            <div className="p-3 bg-red-50 border rounded text-center">
              <div className="text-sm text-red-700">Rejected</div>
              <div className="text-2xl font-bold text-red-600">{report.rejected}</div>
            </div>
            {mode === 'commit' && (
              <div className="p-3 bg-yellow-50 border rounded text-center">
                <div className="text-sm text-yellow-700">Duplicates Skipped</div>
                <div className="text-2xl font-bold text-yellow-600">{report.duplicatesSkipped}</div>
              </div>
            )}
          </div>

          {report.rejected > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-red-600 mb-2">Rejection Reasons (First 50)</h3>
              <ul className="list-disc pl-5 text-sm text-red-800 bg-red-50 p-4 rounded max-h-64 overflow-y-auto">
                {report.rejectedReasons.slice(0, 50).map((r, i) => (
                  <li key={i}>Row {r.row}: {r.reasons.join(', ')}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Column Mapping</h3>
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border-b text-left">CSV Header</th>
                  <th className="p-2 border-b text-left">Mapped Canonical Field</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.mapping).map(([original, mapped]) => (
                  <tr key={original}>
                    <td className="p-2 border-b font-mono">{original}</td>
                    <td className="p-2 border-b font-mono text-blue-600">{mapped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === 'dryrun' && report.rejected === 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-4 text-green-700 font-medium">All rows valid! Ready to commit.</p>
              <button 
                onClick={() => handleUpload('commit')}
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {loading && mode === 'commit' ? 'Committing...' : 'Commit Import'}
              </button>
            </div>
          )}
          
          {mode === 'dryrun' && report.rejected > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="text-red-600 font-medium">Fix the errors in the CSV and re-upload before committing.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
