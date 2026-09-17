'use client';

import { useRef } from 'react';
import type { SermonChapter, SermonMedia } from '@zion8/contracts';

export function SermonPlayer({
  media,
  chapters,
}: {
  media: SermonMedia;
  chapters: SermonChapter[];
}) {
  const audioRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  if (!media.url || (media.kind !== 'AUDIO' && media.kind !== 'VIDEO')) return null;

  function seek(ms: number | null) {
    if (ms === null || !audioRef.current) return;
    audioRef.current.currentTime = ms / 1000;
    void audioRef.current.play();
  }

  return (
    <div className="space-y-3">
      {media.kind === 'VIDEO' ? (
        <video
          ref={(node) => {
            audioRef.current = node;
          }}
          controls
          src={media.url}
          className="w-full rounded-xl bg-black"
        />
      ) : (
        <audio
          ref={(node) => {
            audioRef.current = node;
          }}
          controls
          src={media.url}
          className="w-full"
        />
      )}
      {chapters.length > 0 ? (
        <ol className="space-y-1 text-sm">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => seek(chapter.startMs)}
                className="text-left text-zion-200 transition hover:text-white"
              >
                {chapter.title}
                {chapter.startMs !== null ? ` · ${formatMs(chapter.startMs)}` : ''}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
