import Shepherd from 'shepherd.js';

/**
 * Onboarding tour configuration for new users
 * Guides them through key features of the app
 * 
 * CSS is imported globally in App.tsx to avoid Vite resolution issues
 */

export const createAppTour = () => {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: 'shepherd-theme-custom',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: {
        enabled: true,
      },
    },
  });

  // Step 1: Welcome
  tour.addStep({
    id: 'welcome',
    title: 'Welcome to iSchkul!',
    text: 'Let\'s take a quick tour to help you get started. Click "Next" to continue.',
    buttons: [
      {
        text: 'Skip Tour',
        action: () => tour.cancel(),
        classes: 'shepherd-button-secondary',
      },
      {
        text: 'Next',
        action: () => tour.next(),
        classes: 'shepherd-button-primary',
      },
    ],
  });

  // Step 2: Dashboard overview
  tour.addStep({
    id: 'dashboard-overview',
    title: 'Your Dashboard',
    text: 'This is your dashboard - your central hub for learning. You\'ll see your XP progress, level, and recent activity here.',
    attachTo: {
      element: '[data-tour="dashboard-main"]',
      on: 'bottom',
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

  // Step 3: Leaderboard
  tour.addStep({
    id: 'leaderboard-intro',
    title: 'Leaderboard',
    text: 'Compete with other students on the leaderboard. Earn XP by completing quizzes, participating in groups, and more!',
    attachTo: {
      element: '[data-tour="leaderboard-nav"]',
      on: 'right',
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

  // Step 4: Take Quizzes
  tour.addStep({
    id: 'quiz-feature',
    title: 'Take Quizzes',
    text: 'Test your knowledge by taking quizzes. You can create your own quizzes or take public ones shared by others.',
    attachTo: {
      element: '[data-tour="quiz-nav"]',
      on: 'right',
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

  // Step 5: Groups
  tour.addStep({
    id: 'groups-feature',
    title: 'Join Study Groups',
    text: 'Join or create study groups to collaborate with classmates. Share resources, take group quizzes, and learn together.',
    attachTo: {
      element: '[data-tour="groups-nav"]',
      on: 'right',
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

  // Step 6: Co-Reader
  tour.addStep({
    id: 'coreader-feature',
    title: 'AI Co-Reader',
    text: 'Upload PDFs or study materials. Our AI Co-Reader will help you understand and summarize your documents.',
    attachTo: {
      element: '[data-tour="coreader-nav"]',
      on: 'right',
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

  // Step 7: Profile
  tour.addStep({
    id: 'profile-intro',
    title: 'Your Profile',
    text: 'Customize your profile, upload an avatar, and view your achievements and badges.',
    attachTo: {
      element: '[data-tour="profile-nav"]',
      on: 'left',
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

  // Step 8: Final
  tour.addStep({
    id: 'tour-complete',
    title: 'You\'re All Set!',
    text: 'You\'re ready to start learning. Remember, you can access this tour anytime from settings. Happy learning!',
    buttons: [
      {
        text: 'Start Learning',
        action: () => tour.complete(),
        classes: 'shepherd-button-primary',
      },
    ],
  });

  return tour;
};

/**
 * Determine if user should see the tour
 * (New users, or users who haven't completed it)
 */
export const shouldShowTour = (user: any): boolean => {
  if (!user) return false;
  // Show tour for new users (created in last 1 hour) or those with low XP/level
  if (user.xp === 0 && user.level === 1) {
    return true;
  }
  return false;
};

/**
 * Mark tour as completed in localStorage
 */
export const markTourCompleted = (userId: string) => {
  const completed = JSON.parse(localStorage.getItem('tours_completed') || '{}');
  completed[userId] = new Date().toISOString();
  localStorage.setItem('tours_completed', JSON.stringify(completed));
};

/**
 * Check if user has already completed the tour
 */
export const hasCompletedTour = (userId: string): boolean => {
  const completed = JSON.parse(localStorage.getItem('tours_completed') || '{}');
  return !!completed[userId];
};
