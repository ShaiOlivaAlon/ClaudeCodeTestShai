import React, { useCallback, useRef, useState } from 'react';
import { FolderUp, Image as ImageIcon, Loader2 } from 'lucide-react';
import { filesFromDrop, filesFromInput, ingestFiles } from '../utils/assets';
import { Asset } from '../types';

interface Props {
  onIngested: (assets: Asset[]) => void;
}

export default function FolderDrop({ onIngested }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: { file: File; relativePath: string }[]) => {
      setBusy(true);
      setError(null);
      try {
        const assets = await ingestFiles(files);
        onIngested(assets);
        setLastCount(assets.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to ingest files');
      } finally {
        setBusy(false);
      }
    },
    [onIngested]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = await filesFromDrop(e.dataTransfer);
      await handleFiles(files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          dragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Reading files…</span>
          </div>
        ) : (
          <>
            <FolderUp className="w-10 h-10 mx-auto text-primary-500 mb-2" />
            <p className="font-semibold text-gray-800">
              Drag a folder here, or pick one
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Subfolders are preserved. PNG, JPG, WebP, GIF, BMP, AVIF.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <button
                type="button"
                className="btn-primary"
                onClick={() => dirInputRef.current?.click()}
              >
                Choose folder
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4 inline mr-1" />
                Add images
              </button>
            </div>
          </>
        )}
        <input
          ref={dirInputRef}
          type="file"
          /* @ts-expect-error non-standard, supported by Chromium and WebKit */
          webkitdirectory=""
          multiple
          hidden
          onChange={async (e) => {
            const files = await filesFromInput(e.currentTarget);
            await handleFiles(files);
            e.currentTarget.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = await filesFromInput(e.currentTarget);
            await handleFiles(files);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {lastCount !== null && !error && (
        <div className="text-sm text-gray-500">
          Added {lastCount} image{lastCount === 1 ? '' : 's'}.
        </div>
      )}
    </div>
  );
}
