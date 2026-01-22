import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Award, Target, Users, Lightbulb, Facebook, Linkedin } from 'lucide-react';
import TestimonyImg from "../components/images/Testimony.jpg";
import JeffreyImg from "../components/images/Jeffrey.jpg";

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

  const technologies = [
    { name: 'AI Architecture', role: 'OpenAI GPT-4o' },
    { name: 'Data Management', role: 'MongoDB'},
    { name: 'Real-Time Features', role: 'WebSocket' },
    { name: 'Infrastructure', role: 'Express and Node.js Static Web Apps' },
  ];

  const team = [
    {
      name: "Edward Godspower",
      role: "Product Manager",
      avatar: "https://randomuser.me/api/portraits/med/men/44.jpg",
      bio: "Loves building scalable web apps.",
      social: {
        facebook: "https://www.facebook.com/profile.php?id=61571600835845",
      },
    },
    {
      name: "Abolude Testimony",
      role: "Lead Developer",
      avatar: TestimonyImg,
      bio: "Passionate about education and technology.",
      social: {
        facebook: "https://www.facebook.com/abolude.etestimony",
        linkedin:
          "https://www.linkedin.com/in/testimony-abolude-0b261133a?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
      },
    },
    {
      name: "Usman Jeffrey",
      role: "AI and ML Specialist",
      avatar: JeffreyImg,
      bio: "AI/ML Engineer, Chief innovator/advisor and Data Specialist.",
      social: {
        facebook: "https://www.facebook.com/jeffrey.usman.52",
        linkedin:
          "https://www.linkedin.com/in/jeffrey-usman-a0b953352?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
      },
    },
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
            {technologies.map((tech, index) => (
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

      {/* Meet the Team */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">Meet the Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all text-center"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-blue-100"
                />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{member.name}</h3>
                <p className="text-sm text-blue-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 text-sm mb-4">{member.bio}</p>
                {member.social && Object.keys(member.social).length > 0 && (
                  <div className="flex gap-3 justify-center">
                    {member.social.facebook && (
                      <a
                        href={member.social.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                        title="Facebook Profile"
                      >
                        <Facebook size={20} />
                      </a>
                    )}
                    {member.social.linkedin && (
                      <a
                        href={member.social.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-800 transition-colors"
                        title="LinkedIn Profile"
                      >
                        <Linkedin size={20} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">iSchkul – Smart Learning Made Simple</h2>
          <p className="text-lg text-blue-100 mb-8">
            Built to deliver intelligent quizzes, content generation, and semantic search with scalable serverless architecture and comprehensive documentation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">AI-Powered Quiz & Content Generation</p>
              <p className="text-blue-100 text-sm">GPT-4o for quiz and content generation</p>
            </div>
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">Semantic Search</p>
              <p className="text-blue-100 text-sm">Vector embeddings for semantic retrieval</p>
            </div>
            <div className="bg-blue-700 bg-opacity-50 p-6 rounded-lg backdrop-blur-sm">
              <p className="font-semibold mb-2">Serverless Architecture</p>
              <p className="text-blue-100 text-sm">Scalable and efficient backend</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
