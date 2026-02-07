import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportStats {
  totalParsed: number;
  inserted: number;
  skipped: number;
  errors: number;
  contactMatches: number;
  contactMisses: number;
}

interface ImportResult {
  success: boolean;
  stats: ImportStats;
  group: string;
}

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractGroupName = (filename: string): string => {
    const match = filename.match(/WhatsApp Chat with (.+)\.txt$/i);
    return match ? match[1] : '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.txt') || file.type === 'text/plain') {
        const extractedName = extractGroupName(file.name);
        setSelectedFile(file);
        setGroupName(extractedName);
        setError(null);
        setResult(null);

        if (!extractedName) {
          setError('Could not extract group name from filename. Expected format: "WhatsApp Chat with Group_Name.txt"');
        }
      } else {
        setError('Please select a .txt file (WhatsApp chat export)');
        setSelectedFile(null);
        setGroupName('');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !groupName) {
      setError('Please select a valid WhatsApp chat export file');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const chatText = await selectedFile.text();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-whatsapp-chat`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatText,
          groupName,
          skipClassification: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const data = await response.json();
      setResult(data);
      setSelectedFile(null);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import chat');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Import WhatsApp Chat</h1>
          <p className="text-gray-600">
            Upload exported WhatsApp chat history to enrich your database with historical context
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">How to Export from WhatsApp</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Open the WhatsApp group you want to export</li>
              <li>Tap the group name at the top</li>
              <li>Scroll down and tap "Export chat"</li>
              <li>Choose "Without Media" (recommended)</li>
              <li>Save the .txt file and upload it below</li>
            </ol>
          </div>

          <div className="border-t pt-6">
            {groupName && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Detected Group:</span> {groupName}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Chat Export
              </label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="file-input"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    selectedFile
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  } ${importing ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className={`w-8 h-8 mb-2 ${selectedFile ? 'text-green-600' : 'text-gray-400'}`} />
                    {selectedFile ? (
                      <p className="text-sm text-green-700 font-medium">{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">WhatsApp chat export (.txt file)</p>
                      </>
                    )}
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept=".txt"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                </label>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={!selectedFile || !groupName || importing}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Import Chat History
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-1">Import Failed</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900 text-lg mb-1">
                  Import Complete!
                </h3>
                <p className="text-sm text-green-700">
                  Successfully imported chat history for {result.group}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{result.stats.totalParsed}</div>
                <div className="text-sm text-gray-600">Messages Parsed</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{result.stats.inserted}</div>
                <div className="text-sm text-gray-600">Messages Inserted</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{result.stats.contactMatches}</div>
                <div className="text-sm text-gray-600">Contacts Matched</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{result.stats.contactMisses}</div>
                <div className="text-sm text-gray-600">Unknown Contacts</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-600">{result.stats.skipped}</div>
                <div className="text-sm text-gray-600">Skipped (Media)</div>
              </div>
              {result.stats.errors > 0 && (
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">{result.stats.errors}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
              )}
            </div>

            {result.stats.contactMisses > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> {result.stats.contactMisses} messages couldn't be matched to existing contacts.
                  These messages were still imported but might need manual contact linking later.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Tips for Best Results</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>The group name is automatically extracted from the filename</li>
            <li>Make sure the group exists in your Groups page with the exact same name</li>
            <li>Export without media for faster processing</li>
            <li>Ensure contact names match those in your Contacts page</li>
            <li>The AI will have access to this context for better analysis</li>
          </ul>
        </div>
      </div>
  );
}
