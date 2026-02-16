import { create } from 'zustand';

type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended';

interface CallState {
  status: CallStatus;
  setStatus: (status: CallStatus) => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status })
}));
