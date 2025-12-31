import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <div className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last updated: December 29, 2025</p>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              ischkul ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">2.1 Information You Provide</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Account registration data (name, email, password)</li>
                  <li>Profile information (institution, student category, avatar)</li>
                  <li>Educational content you upload (PDFs, study materials)</li>
                  <li>Quiz responses and flashcard data</li>
                  <li>Chat messages and collaborative content</li>
                  <li>Security questions and answers for account recovery</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">2.2 Information Automatically Collected</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Device information (browser type, operating system)</li>
                  <li>Usage analytics (pages visited, features used, time spent)</li>
                  <li>IP address and location data</li>
                  <li>Learning statistics and progress data</li>
                  <li>Server logs and performance metrics</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Providing and improving our services</li>
              <li>Personalizing your learning experience with AI</li>
              <li>Generating customized quizzes and study materials</li>
              <li>Processing payments and sending related updates</li>
              <li>Responding to support requests</li>
              <li>Analyzing usage patterns for service optimization</li>
              <li>Enforcing our Terms of Service and legal obligations</li>
              <li>Sending educational content and feature updates</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement comprehensive security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>End-to-end encryption for sensitive data</li>
              <li>Azure infrastructure with SOC 2 Type II compliance</li>
              <li>Bcrypt password hashing with 10 salt rounds</li>
              <li>JWT tokens with 7-day expiration for sessions</li>
              <li>Regular security audits and penetration testing</li>
              <li>Role-based access control (RBAC)</li>
              <li>Data isolation in Cosmos DB</li>
            </ul>
          </section>

          {/* AI and Data Processing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. AI and Data Processing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your content is processed by Azure OpenAI (GPT-4o) for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Quiz and flashcard generation</li>
              <li>PDF content analysis and summarization</li>
              <li>Personalized learning recommendations</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              <strong>Important:</strong> We do not use your content to train our models. All AI processing is isolated to your learning session.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the following Microsoft Azure services:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Cosmos DB:</strong> Data storage (subject to Azure Privacy Statement)</li>
              <li><strong>Blob Storage:</strong> File uploads (subject to Azure Privacy Statement)</li>
              <li><strong>OpenAI:</strong> AI processing (subject to Azure OpenAI terms)</li>
              <li><strong>Web PubSub:</strong> Real-time messaging (subject to Azure Privacy Statement)</li>
              <li><strong>AI Search:</strong> Vector retrieval (subject to Azure Privacy Statement)</li>
            </ul>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Export your learning data in standard formats</li>
              <li>Opt-out of marketing communications</li>
              <li>Request information about data processing</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              To exercise these rights, contact us at privacy@ischkul.com
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              ischkul complies with COPPA and similar child protection laws. If you are under 13, parental consent is required. We do not knowingly collect information from children under 13 without verified parental consent.
            </p>
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We retain data as follows:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Account data:</strong> Until deletion requested</li>
              <li><strong>Learning progress:</strong> Until deletion requested</li>
              <li><strong>Usage logs:</strong> 90 days for analytics</li>
              <li><strong>Backup data:</strong> 30 days after deletion for recovery</li>
              <li><strong>Security logs:</strong> 1 year for compliance</li>
            </ul>
          </section>

          {/* Responsible AI */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Responsible AI</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ischkul is built with responsible AI principles:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>No bias in quiz generation through prompt engineering</li>
              <li>Content moderation to prevent harmful materials</li>
              <li>Admin oversight of AI-generated content</li>
              <li>Transparency about AI usage in learning</li>
              <li>Regular audits of model outputs</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or our practices:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg">
              <p className="text-gray-700 mb-2">
                <strong>Email:</strong> privacy@ischkul.com
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Address:</strong> ischkul Privacy Team, Cloud Services Division
              </p>
              <p className="text-gray-700">
                <strong>Response time:</strong> 10 business days
              </p>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes via email or prominent notice on our website. Your continued use of ischkul constitutes acceptance of updates.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};
