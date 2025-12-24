import React from 'react';
import GameCanvas from '../components/GameCanvas';

export default function Page() {
  return (
    <main className="w-full h-screen bg-gray-900 text-white">
      <GameCanvas />
    </main>
  );
}