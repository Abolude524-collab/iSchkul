# ischkul-azure Frontend

## Overview

React + Vite frontend for ischkul, a cloud-native collaborative learning platform.

**Features**:
- Mobile-first, responsive design (TailwindCSS)
- Built for Azure Static Web Apps
- Offline-ready (Service Worker pattern)
- API integration with Azure Functions backend

## Project Structure

```
frontend/
├── src/
│   ├── pages/          # Page components (Dashboard, Login, etc.)
│   ├── components/     # Reusable UI components
│   ├── services/       # API clients and state management
│   │   ├── api.ts      # REST client (axios)
│   │   └── store.ts    # Zustand stores (auth, quiz, chat)
│   ├── styles/         # TailwindCSS global styles
│   ├── App.tsx         # Root component
│   └── main.tsx        # Entry point
├── vite.config.ts      # Vite config
├── tailwind.config.js  # TailwindCSS config
├── tsconfig.json       # TypeScript config
└── package.json
```

## Setup

```bash
# Install dependencies
npm install

# Start dev server (with Vite)
npm run dev
# Opens: http://localhost:5173

# Build for production
npm run build
# Output: dist/
```

## Development

### API Integration

API client is configured in `src/services/api.ts`:

```typescript
// Example: Login
import { authAPI } from './services/api'

const { token, user } = await authAPI.login(email, password)
```

### State Management

Using Zustand for global state:

```typescript
import { useAuthStore, useQuizStore, useChatStore } from './services/store'

// In component:
const { user, token, login } = useAuthStore()
const { currentQuiz, setCurrentQuiz } = useQuizStore()
```

### Styling

TailwindCSS utility-first approach:

```tsx
// Global styles in src/styles/index.css
// Utility classes: text-3xl, bg-primary, hover:bg-blue-600

<button className="btn-primary w-full">Login</button>
```

## Mobile-First Design

Breakpoints:
- `sm`: 640px (tablets)
- `md`: 768px (small laptops)
- `lg`: 1024px (desktops)

Example:
```tsx
<div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
  {/* Single column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

## Deployment to Azure Static Web Apps

```bash
# Build
npm run build

# Deploy via Azure CLI
az staticwebapp create \
  --name ischkul-app \
  --resource-group ischkul-rg \
  --source ./dist \
  --api-location functions

# Or: Connect GitHub repo for auto-deployment
```

## Environment Variables

Create `.env.local`:

```
VITE_API_URL=http://localhost:7071/api  # Dev
VITE_API_URL=https://ischkul-api.azurewebsites.net/api  # Prod
```

Reference in code:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL
```

## Key Components (To Build)

- [ ] LoginPage
- [ ] DashboardPage
- [ ] CoReaderPage (PDF upload + query)
- [ ] QuizGeneratorPage
- [ ] GroupsPage
- [ ] ChatPage
- [ ] LeaderboardPage

## Service Worker (Offline Support)

```typescript
// Future: Add service worker for offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

## Testing

```bash
npm run test
```

Uses Vitest (configured in vite.config.ts).

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for full system design.
