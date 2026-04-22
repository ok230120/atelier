import React from 'react';
import { Link } from 'react-router-dom';
import { RiBookOpenLine, RiImageLine, RiMovie2Fill, RiAddLine } from 'react-icons/ri';

type MainPanelProps = {
  title: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
};

type PlaceholderPanelProps = {
  title: string;
  label: string;
};

function MainPanel({ title, label, description, href, icon: Icon, accentClass }: MainPanelProps) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-[30px] border border-border/80 bg-bg-panel/90 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-border-light hover:shadow-glow"
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${accentClass}`} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_38%)] opacity-70" />

      <div className="relative z-10 flex h-full min-h-[240px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-text-dim">{label}</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-white">{title}</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-bg-surface/80 text-white transition-colors duration-300 group-hover:border-border-light">
            <Icon className="text-[24px]" />
          </div>
        </div>

        <p className="mt-auto max-w-[18rem] text-sm leading-7 text-text-muted">{description}</p>
      </div>
    </Link>
  );
}

function PlaceholderPanel({ title, label }: PlaceholderPanelProps) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-dashed border-border/80 bg-bg-panel/40 p-6 opacity-80">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />

      <div className="relative z-10 flex h-full min-h-[240px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-text-dim">{label}</div>
            <h2 className="mt-3 font-heading text-3xl font-bold text-text-muted">{title}</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-bg-surface/40 text-text-dim">
            <RiAddLine className="text-[24px]" />
          </div>
        </div>

        <p className="mt-auto max-w-[18rem] text-sm leading-7 text-text-dim">Future module</p>
      </div>
    </div>
  );
}

const mainPanels: MainPanelProps[] = [
  {
    title: 'Videos',
    label: 'Screen Library',
    description: '動画ライブラリを開いて、閲覧と整理を行います。',
    href: '/videos',
    icon: RiMovie2Fill,
    accentClass: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500',
  },
  {
    title: 'Novels',
    label: 'Reading Room',
    description: '小説一覧、読書、管理画面へ進みます。',
    href: '/novels',
    icon: RiBookOpenLine,
    accentClass: 'bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400',
  },
  {
    title: 'Images',
    label: 'Visual Archive',
    description: '画像アーカイブ、インポート、タグ付けの起点です。',
    href: '/images',
    icon: RiImageLine,
    accentClass: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-400',
  },
];

const placeholderPanels: PlaceholderPanelProps[] = [
  { title: 'Module', label: 'Reserved Slot' },
  { title: 'Module', label: 'Reserved Slot' },
  { title: 'Module', label: 'Reserved Slot' },
];

const HomePage: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl pt-8">
      <section className="mb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.34em] text-text-dim">atelier</div>
          <h1 className="mt-4 font-heading text-4xl font-bold text-white">Workspace</h1>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {mainPanels.map((panel) => (
          <MainPanel key={panel.title} {...panel} />
        ))}
        {placeholderPanels.map((panel, index) => (
          <PlaceholderPanel key={`${panel.label}-${index}`} {...panel} />
        ))}
      </section>
    </div>
  );
};

export default HomePage;
