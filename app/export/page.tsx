"use client";

import { useState } from "react";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setResult(null);

    try {
      console.log("🚀 Starting database export...");

      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
      console.log("✅ Export completed:", data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("❌ Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              📊 Database Export
            </h1>

            <p className="text-gray-600 mb-8">
              Export all database tables to CSV and SQL formats in Supabase
              Storage.
            </p>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isExporting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isExporting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                "🚀 Start Export"
              )}
            </button>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Export Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Export Completed Successfully!
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        <strong>Export Folder:</strong> {result.exportFolder}
                      </p>
                      <p>
                        <strong>Timestamp:</strong> {result.timestamp}
                      </p>
                      <p className="mt-2">
                        Check your Supabase Storage bucket{" "}
                        <code className="bg-green-100 px-1 rounded">
                          db_exports
                        </code>{" "}
                        for the exported files.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 text-xs text-gray-500">
              <p>
                This will export all tables from your database to CSV and SQL
                formats.
              </p>
              <p>
                The files will be saved in Supabase Storage with timestamped
                folders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
