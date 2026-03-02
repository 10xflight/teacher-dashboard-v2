'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FlashcardsPreview({ material, onUpdate }: { material: any; onUpdate?: (m: any) => void }) {
  return (
    <div className="text-black font-serif">
      {material.instructions && (
        <p className="text-sm italic text-gray-600 mb-4">{material.instructions}</p>
      )}

      {/* Flashcard grid — printable cards */}
      <div className="grid grid-cols-2 gap-3">
        {material.cards?.map((card: any, i: number) => (
          <div key={i} className="border-2 border-gray-300 rounded p-3 min-h-[100px]">
            <p className="text-sm font-bold">{card.front}</p>
            <p className="text-sm mt-1">{card.back}</p>
            {card.pronunciation && (
              <p className="text-xs text-gray-500 italic mt-1">[{card.pronunciation}]</p>
            )}
            {card.example_sentence && (
              <p className="text-xs text-gray-600 mt-1 border-t border-gray-200 pt-1">
                {card.example_sentence}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
