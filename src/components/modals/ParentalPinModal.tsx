import React, { useState } from 'react';
import { Lock, Delete, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ParentalPinModal: React.FC = () => {
  const { pinPromptCallback, verifyPinAndUnlock, closePinPrompt } =
    useAppStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!pinPromptCallback) return null;

  const handleDigit = (digit: string) => {
    setError(false);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      const ok = verifyPinAndUnlock(next);
      if (!ok) {
        setError(true);
        setPin('');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-[#0F1626] border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center space-y-5 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Lock className="w-5 h-5" />
            <span>Parental Control PIN</span>
          </div>
          <button
            onClick={closePinPrompt}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Enter your 4-digit PIN to unlock restricted content
        </p>

        {/* PIN Dots */}
        <div className="flex justify-center space-x-3 py-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold ${
                error
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : pin.length > idx
                    ? 'border-sky-400 bg-sky-500/20 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-600'
              }`}
            >
              {pin.length > idx ? '•' : ''}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-xs text-red-400 font-semibold">
            Incorrect PIN. Please try again.
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="py-3 rounded-xl bg-slate-900 hover:bg-sky-500 hover:text-slate-950 border border-slate-800 text-lg font-bold text-white transition-colors focus:ring-2 focus:ring-sky-400"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setPin('')}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-3 rounded-xl bg-slate-900 hover:bg-sky-500 hover:text-slate-950 border border-slate-800 text-lg font-bold text-white focus:ring-2 focus:ring-sky-400"
          >
            0
          </button>
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
