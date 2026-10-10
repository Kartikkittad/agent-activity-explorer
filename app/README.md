# Agent Activity Explorer (Part A)

React 19 + TypeScript + Vite. Talks to the mock API from the repo root.

```bash
# terminal 1, repo root
npm run api            # http://localhost:4000

# terminal 2
cd app
npm install
npm run dev            # http://localhost:5173
npm test               # vitest
npm run build
```

Set `VITE_API_URL` to point at a different API.

## Where things are

| Path | What |
|---|---|
| `src/api/` | `fetch` wrapper with typed errors, React Query hooks, retry policy |
| `src/lib/filters.ts` | URL ⇄ filters parsing (the URL is the source of truth) |
| `src/lib/virtual.ts` | Virtualization maths for the hand-rolled list |
| `src/components/EventTable.tsx` | Virtualized grid, infinite loading, keyboard navigation |
| `src/components/DetailPanel.tsx` | Linkable detail panel (`?event=<id>`) |

## Keyboard

- `/` focus search
- `↑`/`↓` or `j`/`k`, `PageUp`/`PageDown`, `Home`/`End` move through the list
- `Enter` open the event, `Esc` close the panel (or clear the search field first)
