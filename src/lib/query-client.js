import { QueryClient } from '@tanstack/react-query';
import { onDataChanged, createDebouncedTrigger } from '@/lib/dataChanged';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Coming back to the app shows current figures rather than whatever was
			// cached when you left. Unchanged data keeps its identity (structural
			// sharing), so a refetch that finds nothing new re-renders nothing.
			refetchOnWindowFocus: true,
			retry: 1,
		},
	},
});

// Every successful write refreshes what is on screen. invalidateQueries() marks all
// cached data stale — overriding any staleTime — and refetches only the queries
// currently rendered; screens that are not open simply load fresh when next opened.
// Debounced so one posting (many writes) causes one refresh, not one per write.
onDataChanged(createDebouncedTrigger(() => queryClientInstance.invalidateQueries(), 500));
