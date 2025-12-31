import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Award, Target, Users, Lightbulb } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const values = [
    {
      icon: Target,
      title: 'Student-Centric',
      description: 'We design every feature with students in mind, focusing on effectiveness and engagement.',
    },
    {
      icon: Lightbulb,
      title: 'Innovation',
      description: 'Leveraging cutting-edge AI and cloud technology to revolutionize online education.',
    },
    {
      icon: Users,
      title: 'Collaboration',
      description: 'Building a community where learners support each other and grow together.',
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'Committed to providing the highest quality learning experience and outcomes.',
    },
  ];

  const team = [
    { name: 'AI Architecture', role: 'Azure OpenAI, GPT-4o' },
    { name: 'Data Management', role: 'Cosmos DB, Azure AI Search' },
    { name: 'Real-Time Features', role: 'Web PubSub, SignalR' },
    { name: 'Infrastructure', role: 'Azure Functions, Static Web Apps' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About ischkul</h1>
          <p className="text-lg text-blue-100 max-w-2xl">
            Reimagining education with AI-powered intelligence, real-time collaboration, and scientific learning methods.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Our Mission</h2>
              <p className="text-lg text-gray-600 mb-4">
                To democratize access to intelligent tutoring and collaborative learning through innovative AI and cloud technology.
              </p>
              <p className="text-lg text-gray-600 mb-4">
                We believe that every student, regardless of background or location, deserves access to personalized, adaptive learning experiences that help them achieve their full potential.
              </p>
              <p className="text-lg text-gray-600">
                ischkul combines proven learning science—spaced repetition, active recall, and social learning—with modern AI to create the most effective study platform.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-12 hidden md:block">
              <div className="space-y-6">
                <div className="h-4 bg-blue-400 rounded-full w-3/4"></div>
                <div className="h-4 bg-purple-400 rounded-full w-full"></div>
                <div className="h-4 bg-pink-400 rounded-full w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">Built on Modern Tech</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {team.map((tech, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all"
              >
                <h3 className="font-semibold text-gray-900 mb-2">{tech.name}</h3>
                <p className="text-sm text-gray-600">{tech.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-all"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mb-4">
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Innovation Highlights */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">Why Choose ischkul?</h2>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Personalization</h3>
                <p className="text-gray-600">
                  GPT-4o generates customized quizzes and flashcards tailored to your learning style and pace.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Proven Learning Science</h3>
                <p className="text-gray-600">
                  SM-2 spaced repetition algorithm optimizes retention and reduces study time by 40%.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Collaboration</h3>
                <p className="text-gray-600">
                  Study groups, instant messaging, and group quizzes powered by Azure Web PubSub.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise-Grade Security</h3>
                <p className="text-gray-600">
                  Built on Azure with encryption, SOC 2 compliance, and responsible AI safeguards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Imagine Cup 2026 */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Imagine Cup 2026</h2>
          <p className="text-lg text-blue-100 mb-8">
            ischkul meets all competition criteria: ≥2 Microsoft AI services, serverless architecture, responsible AI, and comprehensive documentation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">Azure OpenAI</p>
              <p className="text-blue-100 text-sm">GPT-4o for quiz and content generation</p>
            </div>
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">Azure AI Search</p>
              <p className="text-blue-100 text-sm">Vector embeddings for semantic retrieval</p>
            </div>
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">Azure Functions</p>
              <p className="text-blue-100 text-sm">Serverless compute for scalability</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
