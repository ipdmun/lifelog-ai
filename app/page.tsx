'use client';

import { Upload, FileText, Layout, PenTool, CheckCircle, Camera, Calendar, Printer, Search, Tag, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-block px-4 py-1.5 bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-full text-[var(--color-primary-700)] text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in-up">
            {t('badgeNew')}
          </div>

          {/* Hero Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold text-[var(--color-neutral-900)] mb-6 tracking-tight leading-tight animate-fade-in-up delay-100">
            {t('heroTitle')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)]">{t('heroTitleAccent')}</span>
          </h1>

          {/* Hero Description */}
          <p className="text-lg sm:text-xl text-[var(--color-neutral-600)] mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
            {t('heroDesc')}
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
            <Link href="/scan">
              <Button variant="primary" size="lg" leftIcon={<Camera size={20} />}>
                {t('btnScan')}
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="outline" size="lg" leftIcon={<Upload size={20} />}>
                {t('btnUpload')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 bg-white border-t border-[var(--color-neutral-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-neutral-900)] mb-4">
              {t('featHeader')}
            </h2>
            <p className="text-[var(--color-neutral-600)] max-w-2xl mx-auto">
              {t('featSubpage')}
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon={<Camera size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat1Title')}
              description={t('feat1Desc')}
            />
            <FeatureCard
              icon={<Search size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat2Title')}
              description={t('feat2Desc')}
            />
            <FeatureCard
              icon={<Calendar size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat3Title')}
              description={t('feat3Desc')}
            />
            <FeatureCard
              icon={<Tag size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat4Title')}
              description={t('feat4Desc')}
            />
            <FeatureCard
              icon={<Printer size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat5Title')}
              description={t('feat5Desc')}
            />
            <FeatureCard
              icon={<PenTool size={24} className="text-[var(--color-primary-600)]" />}
              title={t('feat6Title')}
              description={t('feat6Desc')}
            />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-16 sm:py-24 bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-neutral-900)] mb-4">
              {t('demoTitle')}
            </h2>
            <p className="text-[var(--color-neutral-600)] max-w-2xl mx-auto">
              {t('demoDesc')}
            </p>
          </div>
          <div className="relative aspect-video bg-[var(--color-neutral-200)] rounded-2xl flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border border-[var(--color-neutral-300)] shadow-lg overflow-hidden group">
            <img src="/demo-thumbnail.png" alt="Demo Video Thumbnail" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            <div className="relative flex flex-col items-center text-white drop-shadow-md">
              <PlayCircle size={64} className="mb-4 text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              <span className="font-semibold text-lg tracking-wide">{t('demoPlayBtn')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-[var(--color-primary-50)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--color-neutral-900)] mb-6">
            {t('ctaHeader')}
          </h2>
          <p className="text-lg text-[var(--color-neutral-600)] mb-8 max-w-2xl mx-auto">
            {t('ctaDesc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/upload">
              <Button variant="primary" size="lg" leftIcon={<Upload size={20} />}>
                {t('btnStartFree')}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg">
                {t('btnViewDashboard')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

/**
 * FeatureCard Component
 *
 * Reusable feature card for the homepage grid.
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card variant="outlined" padding="lg" hover>
      <div className="flex flex-col items-start">
        {/* Icon Container */}
        <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] flex items-center justify-center mb-4">
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-[var(--color-neutral-900)] mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-[var(--color-neutral-600)] leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
}
