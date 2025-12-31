/**
 * ischkul UI Components Library
 * Reusable component patterns used throughout the application
 */

// ============================================================================
// TYPOGRAPHY
// ============================================================================

// Headings
h1: "text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
h2: "text-3xl md:text-4xl font-bold"
h3: "text-xl md:text-2xl font-semibold"
h4: "text-lg font-semibold"
p: "text-base text-gray-600 leading-relaxed"
p-sm: "text-sm text-gray-600"

// ============================================================================
// BUTTONS
// ============================================================================

// Primary Button
"px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"

// Secondary Button
"px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-all"

// Outline Button
"px-6 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition-all"

// Icon Button
"p-2 hover:bg-gray-200 rounded-lg transition-colors"

// ============================================================================
// CARDS
// ============================================================================

// Card Base
"bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow"

// Card with Gradient Background
"bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-8"

// Stat Card
"bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"

// Feature Card
"bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all"

// ============================================================================
// INPUTS
// ============================================================================

// Text Input
"w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"

// Input with Icon
"w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"

// Select Dropdown
"w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"

// Textarea
"w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"

// ============================================================================
// LAYOUTS
// ============================================================================

// Grid 2 Column
"grid grid-cols-1 md:grid-cols-2 gap-6"

// Grid 3 Column
"grid grid-cols-1 md:grid-cols-3 gap-6"

// Grid 4 Column
"grid grid-cols-1 md:grid-cols-4 gap-6"

// Container Max Width
"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"

// Flex Center
"flex items-center justify-center"

// Flex Between
"flex items-center justify-between"

// ============================================================================
// COLORS & GRADIENTS
// ============================================================================

// Primary Gradient
"bg-gradient-to-r from-blue-600 to-purple-600"

// Secondary Gradient
"bg-gradient-to-br from-purple-500 to-pink-500"

// Success Gradient
"bg-gradient-to-r from-green-600 to-emerald-600"

// Alert Gradient
"bg-gradient-to-r from-orange-500 to-red-500"

// ============================================================================
// STATES
// ============================================================================

// Hover State
"hover:shadow-lg hover:border-blue-300 transition-all"

// Active State
"bg-blue-50 border-l-4 border-blue-600"

// Disabled State
"disabled:opacity-50 disabled:cursor-not-allowed"

// Loading State
"opacity-50"

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// Success Alert
"p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3"

// Error Alert
"p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3"

// Warning Alert
"p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3"

// Info Alert
"p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3"

// ============================================================================
// BADGES & TAGS
// ============================================================================

// Success Badge
"bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full"

// Blue Badge
"bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full"

// Gray Badge
"bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full"

// ============================================================================
// PROGRESS & LOADING
// ============================================================================

// Progress Bar
"w-full bg-gray-200 rounded-full h-2"
"bg-blue-600 h-2 rounded-full transition-all"

// Spinner
"w-12 h-12 text-blue-600 animate-spin"

// Skeleton Loader
"h-4 bg-gray-300 rounded-full animate-pulse"

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================

// Hidden on Mobile
"hidden md:block"
"hidden md:flex"

// Visible on Mobile Only
"md:hidden"

// Responsive Padding
"px-4 sm:px-6 lg:px-8"
"py-12 md:py-24"

// Responsive Font
"text-2xl md:text-3xl lg:text-4xl"

// ============================================================================
// ELEVATION & SHADOWS
// ============================================================================

// Shadow Small
"shadow-sm"

// Shadow Medium
"shadow-md"

// Shadow Large
"shadow-lg"

// Shadow X-Large
"shadow-xl"

// Shadow 2X-Large
"shadow-2xl"

// ============================================================================
// BORDERS
// ============================================================================

// Border All
"border border-gray-300"

// Border Top
"border-t border-gray-300"

// Border Bottom
"border-b border-gray-300"

// Border Left
"border-l-4 border-blue-600"

// Rounded Default
"rounded-lg"

// Rounded Large
"rounded-xl"

// Rounded Full
"rounded-full"

// ============================================================================
// TRANSITIONS
// ============================================================================

// All Transition
"transition-all"

// Color Transition
"transition-colors"

// Transform Transition
"transition-transform"

// Hover Scale
"hover:scale-110 transition-transform"

// ============================================================================
// ANIMATIONS
// ============================================================================

// Spin
"animate-spin"

// Pulse
"animate-pulse"

// Bounce
"animate-bounce"

// ============================================================================
// COMMON PATTERNS
// ============================================================================

// Full Screen Container
"min-h-screen flex flex-col bg-gray-50"

// Flex Grow Container
"flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12"

// Form Space Between
"space-y-4"
"space-y-6"

// Gap Between Elements
"gap-3"
"gap-4"
"gap-6"
"gap-8"

// ============================================================================
// ICON COLORS
// ============================================================================

// Icon Blue
"text-blue-600"

// Icon Purple
"text-purple-600"

// Icon Green
"text-green-600"

// Icon Orange
"text-orange-600"

// Icon Red
"text-red-600"

// Icon Gray
"text-gray-400"
"text-gray-600"

// ============================================================================
// BACKDROP & OVERLAY
// ============================================================================

// Backdrop Blur
"backdrop-blur-sm"

// Background Opacity
"bg-blue-700 bg-opacity-30"

// Opacity Classes
"opacity-75"
"opacity-50"
"opacity-0"
