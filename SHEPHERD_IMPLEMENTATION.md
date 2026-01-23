# Shepherd.js Onboarding Tour - Implementation Guide

## Overview

The onboarding tour has been successfully integrated into iSchkul using Shepherd.js. This guide explains the implementation and how to customize or extend it.

## Files Created/Modified

### New Files Created:
1. **[src/services/tourConfig.ts](src/services/tourConfig.ts)**
   - Main tour configuration
   - Exports: `createAppTour()`, `shouldShowTour()`, `hasCompletedTour()`, `markTourCompleted()`
   - Contains 8 tour steps guiding users through key features

2. **[src/hooks/useTour.ts](src/hooks/useTour.ts)**
   - Custom React hook for tour management
   - Auto-starts tour for new users
   - Handles tour lifecycle (start, stop, complete)

3. **[src/styles/shepherd-theme.css](src/styles/shepherd-theme.css)**
   - Custom iSchkul theme for Shepherd.js
   - Responsive design for mobile devices
   - Pulsing highlight animation for tour targets

### Modified Files:
1. **[src/App.tsx](src/App.tsx)**
   - Added import for shepherd CSS
   - Added import for `useTour` hook
   - Initialized hook in App function

2. **[src/pages/DashboardPage.tsx](src/pages/DashboardPage.tsx)**
   - Added `data-tour="dashboard-main"` attribute to main section

3. **[src/components/Navbar.tsx](src/components/Navbar.tsx)**
   - Added `data-tour` attributes to navigation links:
     - `data-tour="leaderboard-nav"` on Leaderboard link
     - `data-tour="quiz-nav"` on Quiz link
     - `data-tour="flashcards-nav"` on Flashcards link
     - `data-tour="profile-nav"` on Profile button

## How It Works

### Tour Flow

```
New User (XP=0, Level=1) Logs In
        ↓
Dashboard Loads
        ↓
useTour Hook Checks:
  - Is user new? → shouldShowTour()
  - Has tour been completed? → hasCompletedTour()
        ↓
Tour Starts Automatically (if conditions met)
        ↓
User Goes Through 8 Steps:
  1. Welcome
  2. Dashboard Overview
  3. Leaderboard
  4. Take Quizzes
  5. Groups
  6. Co-Reader
  7. Profile
  8. Complete
        ↓
Tour Completed → markTourCompleted()
        ↓
Stored in localStorage['tours_completed']
```

### Key Functions

#### `createAppTour(): Shepherd.Tour`
Creates and configures the main tour with all 8 steps.

```typescript
// Example usage
const tour = createAppTour();
tour.start();
```

#### `shouldShowTour(user): boolean`
Determines if user should see the tour. Currently checks:
- User exists and has 0 XP and level 1

```typescript
// Example
if (shouldShowTour(user)) {
  startTour();
}
```

#### `hasCompletedTour(userId): boolean`
Checks localStorage to see if user already completed the tour.

```typescript
// Example
if (!hasCompletedTour(user.id)) {
  showTour();
}
```

#### `markTourCompleted(userId): void`
Records tour completion in localStorage under key `tours_completed`.

```typescript
// Automatically called when tour completes
markTourCompleted(user.id);
```

## Customization Guide

### Adding New Tour Steps

Edit [src/services/tourConfig.ts](src/services/tourConfig.ts):

```typescript
// Add new step
tour.addStep({
  id: 'new-feature',
  title: 'New Feature Title',
  text: 'Description of the feature.',
  attachTo: {
    element: '[data-tour="new-feature-nav"]', // Target element
    on: 'bottom', // Position: top, bottom, left, right
  },
  buttons: [
    {
      text: 'Back',
      action: () => tour.back(),
      classes: 'shepherd-button-secondary',
    },
    {
      text: 'Next',
      action: () => tour.next(),
      classes: 'shepherd-button-primary',
    },
  ],
});
```

### Adding Tour Targets to Components

Add `data-tour` attribute to any element you want to highlight:

```tsx
// In any component
<button data-tour="my-feature-nav">
  My Feature
</button>
```

Then reference it in tourConfig.ts:

```typescript
attachTo: {
  element: '[data-tour="my-feature-nav"]',
  on: 'right',
}
```

### Changing Tour Trigger Logic

Edit [src/services/tourConfig.ts](src/services/tourConfig.ts), function `shouldShowTour()`:

```typescript
export const shouldShowTour = (user: any): boolean => {
  if (!user) return false;
  
  // Current logic: show for new users
  if (user.xp === 0 && user.level === 1) {
    return true;
  }
  
  // Example: Always show for first 5 logins
  // const loginCount = JSON.parse(localStorage.getItem('loginCount') || '0');
  // if (loginCount < 5) return true;
  
  return false;
};
```

### Styling Tour Popups

Edit [src/styles/shepherd-theme.css](src/styles/shepherd-theme.css):

```css
/* Change primary button color */
.shepherd-theme-custom .shepherd-button-primary {
  background-color: #your-color;
}

/* Change popup background */
.shepherd-theme-custom.shepherd-popup {
  background-color: #your-color;
}

/* Change highlight animation */
@keyframes pulse {
  0%, 100% {
    /* Your custom pulse effect */
  }
}
```

## Storage Format

Tour completion is stored in localStorage:

```json
{
  "tours_completed": {
    "user-id-123": "2024-01-15T10:30:45.000Z",
    "user-id-456": "2024-01-15T11:20:30.000Z"
  }
}
```

## Testing the Tour

### Force Tour to Show (in browser console)

```javascript
// Clear tour completion history
localStorage.removeItem('tours_completed');

// Reset XP/Level indicator
// (Your store will need to be modified for this)

// Refresh page
window.location.reload();
```

### Manual Tour Start

If you want to add a "Restart Tour" button:

```tsx
import { useTour } from '../hooks/useTour';

export function SettingsComponent() {
  const { startTour } = useTour();
  
  return (
    <button onClick={startTour}>
      Restart Tour
    </button>
  );
}
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design included

## Performance Notes

- Shepherd.js is lightweight (~10KB minified)
- CSS animations use GPU acceleration
- Tour targets are selected via `data-tour` attributes (no expensive DOM queries)
- Tour state persists in localStorage (synchronous, <1ms)

## Accessibility Features

- Tab navigation through tour buttons
- Escape key to cancel tour
- Modal overlay prevents interaction with background
- Clear typography and color contrast
- Semantic HTML structure

## Future Enhancements

Potential improvements:

1. **Video Tutorials**: Embed short video clips in tour steps
2. **Step Progress**: Show "Step 3 of 8" indicator
3. **A/B Testing**: Different tour flows for different user segments
4. **Analytics**: Track which tour steps are skipped
5. **Conditional Steps**: Show different content based on user plan/role
6. **Tooltips**: Add persistent help tooltips beyond initial tour

## Troubleshooting

### Tour doesn't start
1. Check if user has `xp === 0` and `level === 1`
2. Check localStorage for `tours_completed` entry
3. Check browser console for errors
4. Verify CSS file is imported in App.tsx

### Tour targets not highlighting
1. Verify `data-tour` attribute exists on target element
2. Check element is rendered in DOM
3. Verify element matches `attachTo.element` selector exactly
4. Check CSS display/visibility is not hidden

### Tour text doesn't fit on mobile
- CSS already handles responsive sizing
- Adjust text length in tourConfig.ts for better fit
- Use shorter button labels

## Support

For issues or questions:
1. Check browser console for errors
2. Review tourConfig.ts for configuration issues
3. Verify all target elements have correct `data-tour` attributes
4. Check shepherd.js documentation: https://shepherdjs.dev/

