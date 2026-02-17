"use client";

import { format } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

type State = {
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      selectedDate: format(new Date(), "yyyy-MM-dd"),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      theme: "light",
      setTheme: (theme) => set({ theme })
    }),
    {
      name: "kcal-ai:store:v1",
      partialize: (state) => ({ selectedDate: state.selectedDate, theme: state.theme })
    }
  )
);
