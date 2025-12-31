# ischkul Frontend - Developer Quick Start Guide

## 📁 Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── AboutPage.tsx
│   │   ├── PrivacyPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── QuizPage.tsx
│   │   ├── FlashcardPage.tsx
│   │   └── ChatPage.tsx
│   ├── components/
│   │   ├── Navbar.tsx          # Main navigation bar
│   │   └── Footer.tsx          # Footer with links
│   ├── services/
│   │   ├── api.ts              # REST API client
│   │   └── store.ts            # Zustand state management
│   ├── App.tsx                 # Router configuration
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── public/
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Server runs on `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

## 🔑 Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS 3** - Styling
- **Lucide React** - Icons
- **React Router v6** - Navigation
- **Zustand** - State management
- **Axios** - HTTP client (in store)

## 🎨 Styling Guide

### TailwindCSS Utility Classes

All pages use TailwindCSS utility-first styling. Common patterns:

```tsx
// Responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Content */}
</div>

// Gradient backgrounds
<div className="bg-gradient-to-r from-blue-600 to-purple-600">

// Hover effects
<button className="hover:shadow-lg hover:border-blue-300 transition-all">

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
```

### Color Palette

- **Primary**: Blue-600 to Purple-600
- **Secondary**: Purple-500 to Pink-500
- **Success**: Green-600
- **Warning**: Orange-500
- **Error**: Red-500
- **Neutral**: Gray-50 to Gray-900

## 🔐 Authentication

### Login Flow

```tsx
import { useAuthStore } from './services/store';
import { useNavigate } from 'react-router-dom';

export const MyComponent = () => {
  const { user, login, logout } = useAuthStore();
  const navigate = useNavigate();

  // Check if user is logged in
  if (!user) {
    navigate('/login');
    return null;
  }

  return <div>Welcome, {user.name}</div>;
};
```

### Protected Routes

```tsx
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Usage in App.tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

## 🌐 API Integration

### Making API Calls

```tsx
const token = localStorage.getItem('token');

const response = await fetch(
  `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/endpoint`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  }
);

const data = await response.json();
```

### Environment Variables

Create `.env` file:
```
VITE_API_URL=http://localhost:7071
VITE_APP_NAME=ischkul
```

Access in code:
```tsx
process.env.REACT_APP_API_URL || 'http://localhost:7071'
```

## 🧩 Component Patterns

### Page Template

```tsx
import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuthStore } from '../services/store';

export const MyPage: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch data
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Page content */}
      </div>
      <Footer />
    </div>
  );
};
```

### Form Component

```tsx
const [formData, setFormData] = useState({ field: '' });
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!response.ok) throw new Error('Failed');
    const data = await response.json();
    // Handle success
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## 📱 Responsive Design

### Breakpoints

- **Mobile**: < 640px (default)
- **Tablet**: 640px - 1024px (md breakpoint)
- **Desktop**: > 1024px (lg breakpoint)
- **Large**: > 1280px (xl breakpoint)

### Responsive Patterns

```tsx
// Two column on desktop, single on mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">

// Hide on mobile
<div className="hidden md:block">

// Show only on mobile
<div className="md:hidden">

// Responsive text size
<h1 className="text-2xl md:text-4xl lg:text-5xl">

// Responsive padding
<div className="px-4 sm:px-6 lg:px-8 py-12 md:py-24">
```

## 🎯 Common Tasks

### Add a New Page

1. Create file in `src/pages/MyPage.tsx`
2. Add route in `App.tsx`
3. Add navigation link in `Navbar.tsx`

```tsx
// src/pages/MyPage.tsx
export const MyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow">Content</div>
      <Footer />
    </div>
  );
};

// src/App.tsx
<Route path="/mypage" element={<MyPage />} />

// src/components/Navbar.tsx
navLinks.push({ label: 'My Page', path: '/mypage' })
```

### Connect to Backend API

```tsx
const fetchData = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || 'http://localhost:7071'}/api/endpoint`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error('Failed');
    const data = await response.json();
    setData(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Handle Loading State

```tsx
{loading ? (
  <div className="flex items-center justify-center">
    <Loader className="w-8 h-8 animate-spin text-blue-600" />
  </div>
) : (
  <div>Content</div>
)}
```

### Display Error

```tsx
{error && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
    <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
    <p className="text-red-700">{error}</p>
  </div>
)}
```

## 🐛 Debugging

### Enable Debugging in Browser

1. Open DevTools (F12)
2. Check Console for errors
3. Use React DevTools extension
4. Check Network tab for API calls

### Common Issues

| Issue | Solution |
|-------|----------|
| Styles not applying | Clear cache, rebuild with `npm run build` |
| API 401 error | Check token in localStorage |
| Page not found | Check route in App.tsx |
| Component not rendering | Check conditional rendering logic |

## 📚 Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
- [React Router](https://reactrouter.com)

## 🚢 Deployment

### Deploy to Azure Static Web Apps

1. Build the project:
```bash
npm run build
```

2. Deploy using Azure CLI:
```bash
az staticwebapp create \
  --name ischkul-frontend \
  --resource-group ischkul-rg \
  --source . \
  --build-folder dist \
  --api-location api
```

3. Or push to GitHub and configure CI/CD

## 📞 Support

For issues or questions:
1. Check the documentation files
2. Review component examples in existing pages
3. Check the backend logs for API errors
4. Use browser DevTools for frontend debugging

---

**Happy coding! 🎉**
