import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, MessageSquare, Zap, Users, Brain, Shield, CloudOff } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { StudentOfTheWeek } from '../components/StudentOfTheWeek';

export const LandingPage: React.FC = () => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Learning',
      description: 'Personalized quiz and flashcard generation using GPT-4o',
    },
    {
      icon: BookOpen,
      title: 'Smart Co-Reader',
      description: 'Extract insights from PDFs with RAG-powered retrieval',
    },
    {
      icon: MessageSquare,
      title: 'Real-Time Chat and Social Learning',
      description: 'Join groups and collaborate with peers through WebSocket powered messaging',
    },
    {
      icon: CloudOff,
      title: ' Learn Anywhere. Even Offline.',
      description: 'Download quizzes and flashcards and keep studying on the go — no internet, no limits.',
    },
    {
      icon: Zap,
      title: 'Spaced Repetition',
      description: 'SM-2 algorithm for optimal learning retention',
    },
    {
      icon: Shield,
      title: 'Responsible AI',
      description: 'Built-in safety measures and content moderation',
    },
  ];

  const stats = [
    { value: '2,500+', label: 'Active Learners' },
    { value: '15,000+', label: 'Quizzes Created' },
    { value: '50,000+', label: 'Study Sessions' },
    { value: '98%', label: 'Student Satisfaction' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-grow bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Learn Smarter with AI
              </h1>
              <p className="text-lg md:text-xl text-blue-100 max-w-xl">
                iSchkul combines AI-powered tutoring, real-time collaboration, and spaced repetition to help students achieve academic excellence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Get Started Free
                  <ArrowRight size={20} />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                >
                  Learn More
                </Link>
              </div>
              <p className="text-sm text-blue-200">No credit card required • Free tier available</p>
            </div>

            {/* Hero Illustration */}
            <div className="hidden md:block">
              <div className="bg-blue-700 bg-opacity-30 rounded-2xl p-8 backdrop-blur-sm border border-blue-400 border-opacity-30">
                <div className="space-y-4">
                  <div className="h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg animate-pulse"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg animate-pulse animation-delay-100"></div>
                    <div className="h-12 bg-gradient-to-r from-pink-400 to-red-400 rounded-lg animate-pulse animation-delay-200"></div>
                  </div>
                  <div className="h-12 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg animate-pulse animation-delay-300"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/*<section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">{stat.value}</p>
                <p className="text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>*/}

      {/* Student of the Week Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Celebrating Excellence</h2>
            <p className="text-gray-600">Meet our top performers who are leading the way in academic achievement</p>
          </div>
          <StudentOfTheWeek />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to master any subject with intelligent learning tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mb-4">
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Learning?</h2>
          <p className="text-lg text-blue-100 mb-8">
            Join students worldwide who are already using ischkul to achieve their academic goals.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-lg"
          >
            Start Learning Now
            <ArrowRight size={24} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};
