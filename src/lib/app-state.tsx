import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  answerReview,
  dayKey,
  dueOrder,
  EMPTY_STATS,
  forToday,
  isDue,
  newReviewState,
  withActivity,
} from '@/lib/progress';
import { CATEGORIES, FAVORITES_ID, ReviewState, Settings, Stats, WordSet } from '@/lib/types';

export const DEFAULT_REMINDER = { enabled: false, hour: 19, minute: 0 };

const FAVORITES: WordSet = { id: FAVORITES_ID, name: 'Favorites', wordIds: [] };

// Everything the app stores locally. Each field is saved under its own AsyncStorage key.
type Data = {
  settings: Settings | null; // null until onboarding is finished
  seenWordIds: string[];
  sets: WordSet[];
  reviews: Record<string, ReviewState>;
  stats: Stats;
  recentAnswers: boolean[]; // last 20 review results, for stretch cards (SPEC 4.12)
  levelUpShown: string[]; // "lang|level" pairs that already showed the one-time level-up card
};

const EMPTY: Data = {
  settings: null,
  seenWordIds: [],
  sets: [FAVORITES],
  reviews: {},
  stats: EMPTY_STATS,
  recentAnswers: [],
  levelUpShown: [],
};

const KEYS = Object.keys(EMPTY) as (keyof Data)[];

type AppState = {
  loaded: boolean;
  settings: Settings | null;
  saveSettings: (s: Settings) => void;
  seenIds: Set<string>;
  markSeen: (id: string) => void;
  sets: WordSet[];
  savedIds: Set<string>;
  toggleFavorite: (wordId: string) => boolean;
  addToSet: (setId: string, wordId: string) => void;
  removeFromSet: (setId: string, wordId: string) => void;
  createSet: (name: string, wordId?: string) => void;
  renameSet: (setId: string, name: string) => void;
  deleteSet: (setId: string) => void;
  reviews: Record<string, ReviewState>;
  stats: Stats;
  recordCardView: () => void;
  answer: (wordId: string, correct: boolean) => ReviewState;
  findDueWord: (allowed: (wordId: string) => boolean) => string | null;
  recentAnswers: boolean[];
  levelUpShown: string[];
  markLevelUpShown: (key: string) => void;
  devStrongLearner: boolean;
  setDevStrongLearner: (on: boolean) => void;
  devSetLastActive: (daysAgo: number) => void;
  devMakeAllDue: () => void;
};

const Ctx = createContext<AppState | null>(null);

function savedIdsOf(sets: WordSet[]) {
  return new Set(sets.flatMap((s) => s.wordIds));
}

// Saving a word for the first time puts it in Leitner box 1.
function withReviewFor(d: Data, wordId: string): Data {
  if (d.reviews[wordId]) return d;
  return {
    ...d,
    reviews: { ...d.reviews, [wordId]: newReviewState(forToday(d.stats).cardsViewed) },
  };
}

function updateSet(d: Data, setId: string, fn: (s: WordSet) => WordSet): Data {
  return { ...d, sets: d.sets.map((s) => (s.id === setId ? fn(s) : s)) };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Data>(EMPTY);
  const [devStrongLearner, setDevStrongLearner] = useState(false);
  const dataRef = useRef(data);

  useEffect(() => {
    (async () => {
      const loadedData = { ...EMPTY };
      try {
        const pairs = await AsyncStorage.multiGet(KEYS);
        for (const [key, raw] of pairs) {
          if (raw) (loadedData as Record<string, unknown>)[key] = JSON.parse(raw);
        }
      } catch {
        // Corrupt or missing storage: start fresh rather than crash.
      }
      if (loadedData.settings && !loadedData.settings.reminder) {
        loadedData.settings = { ...loadedData.settings, reminder: DEFAULT_REMINDER };
      }
      if (loadedData.settings) {
        // Debate was folded into Academic in Phase 3; drop any other unknown IDs.
        const cats = loadedData.settings.categories.map((c) =>
          (c as string) === 'debate' ? 'academic' : c
        );
        const valid = CATEGORIES.filter((c) => cats.includes(c));
        loadedData.settings = { ...loadedData.settings, categories: valid.length ? valid : ['academic'] };
      }
      if (!loadedData.sets.some((s) => s.id === FAVORITES_ID)) {
        loadedData.sets = [FAVORITES, ...loadedData.sets];
      }
      dataRef.current = loadedData;
      setData(loadedData);
      setLoaded(true);
    })();
  }, []);

  // Applies a change and writes only the fields that changed.
  const update = useCallback((fn: (d: Data) => Data) => {
    const prev = dataRef.current;
    const next = fn(prev);
    if (next === prev) return;
    dataRef.current = next;
    setData(next);
    for (const key of KEYS) {
      if (next[key] !== prev[key]) AsyncStorage.setItem(key, JSON.stringify(next[key]));
    }
  }, []);

  const actions = useMemo(
    () => ({
      saveSettings: (settings: Settings) => update((d) => ({ ...d, settings })),

      markSeen: (id: string) =>
        update((d) =>
          d.seenWordIds.includes(id) ? d : { ...d, seenWordIds: [...d.seenWordIds, id] }
        ),

      // Returns true if the word is now in Favorites.
      toggleFavorite: (wordId: string) => {
        const fav = dataRef.current.sets.find((s) => s.id === FAVORITES_ID)!;
        const saving = !fav.wordIds.includes(wordId);
        update((d) => {
          const next = updateSet(d, FAVORITES_ID, (s) => ({
            ...s,
            wordIds: saving ? [...s.wordIds, wordId] : s.wordIds.filter((id) => id !== wordId),
          }));
          return saving ? withReviewFor(next, wordId) : next;
        });
        return saving;
      },

      addToSet: (setId: string, wordId: string) =>
        update((d) =>
          withReviewFor(
            updateSet(d, setId, (s) =>
              s.wordIds.includes(wordId) ? s : { ...s, wordIds: [...s.wordIds, wordId] }
            ),
            wordId
          )
        ),

      removeFromSet: (setId: string, wordId: string) =>
        update((d) =>
          updateSet(d, setId, (s) => ({ ...s, wordIds: s.wordIds.filter((id) => id !== wordId) }))
        ),

      createSet: (name: string, wordId?: string) =>
        update((d) => {
          const set: WordSet = {
            id: `set-${Date.now()}`,
            name,
            wordIds: wordId ? [wordId] : [],
          };
          const next = { ...d, sets: [...d.sets, set] };
          return wordId ? withReviewFor(next, wordId) : next;
        }),

      renameSet: (setId: string, name: string) => update((d) => updateSet(d, setId, (s) => ({ ...s, name }))),

      deleteSet: (setId: string) =>
        update((d) =>
          setId === FAVORITES_ID ? d : { ...d, sets: d.sets.filter((s) => s.id !== setId) }
        ),

      // Called once per new card on screen: drives box 1 timing and the streak.
      recordCardView: () =>
        update((d) => {
          const s = forToday(d.stats);
          return {
            ...d,
            stats: withActivity({ ...s, cardsViewed: s.cardsViewed + 1, viewsToday: s.viewsToday + 1 }),
          };
        }),

      answer: (wordId: string, correct: boolean) => {
        const d = dataRef.current;
        const stats = forToday(d.stats);
        const current = d.reviews[wordId] ?? newReviewState(stats.cardsViewed);
        const next = answerReview(current, correct, stats.cardsViewed);
        update((d2) => ({
          ...d2,
          reviews: { ...d2.reviews, [wordId]: next },
          recentAnswers: [...d2.recentAnswers, correct].slice(-20),
          stats: withActivity({ ...forToday(d2.stats), reviewsToday: forToday(d2.stats).reviewsToday + 1 }),
        }));
        return next;
      },

      // The most overdue saved word that passes `allowed`, or null.
      findDueWord: (allowed: (wordId: string) => boolean) => {
        const d = dataRef.current;
        const { cardsViewed } = forToday(d.stats);
        const due = [...savedIdsOf(d.sets)]
          .filter((id) => d.reviews[id] && allowed(id) && isDue(d.reviews[id], cardsViewed))
          .sort((a, b) => dueOrder(d.reviews[a]) - dueOrder(d.reviews[b]));
        return due[0] ?? null;
      },

      markLevelUpShown: (key: string) =>
        update((d) => (d.levelUpShown.includes(key) ? d : { ...d, levelUpShown: [...d.levelUpShown, key] })),

      // Development-only helpers for testing the streak and reviews on a phone.
      devSetLastActive: (daysAgo: number) =>
        update((d) => {
          const day = new Date();
          day.setDate(day.getDate() - daysAgo);
          const stats = { ...d.stats, lastActive: dayKey(day), streak: Math.max(d.stats.streak, 1) };
          return { ...d, stats: { ...stats, day: dayKey(day), viewsToday: 0, reviewsToday: 0 } };
        }),

      devMakeAllDue: () =>
        update((d) => ({
          ...d,
          reviews: Object.fromEntries(
            Object.entries(d.reviews).map(([id, r]) => [id, { ...r, dueAtCard: 0, dueAt: 0 }])
          ),
        })),
    }),
    [update]
  );

  const seenIds = useMemo(() => new Set(data.seenWordIds), [data.seenWordIds]);
  const savedIds = useMemo(() => savedIdsOf(data.sets), [data.sets]);
  const stats = forToday(data.stats);

  return (
    <Ctx.Provider
      value={{
        loaded,
        settings: data.settings,
        seenIds,
        sets: data.sets,
        savedIds,
        reviews: data.reviews,
        stats,
        recentAnswers: data.recentAnswers,
        levelUpShown: data.levelUpShown,
        devStrongLearner,
        setDevStrongLearner,
        ...actions,
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
