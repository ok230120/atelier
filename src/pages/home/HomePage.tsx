import React from 'react';
import { Link } from 'react-router-dom';
import { RiBookOpenLine, RiImageLine, RiMovie2Fill } from 'react-icons/ri';

type PanelProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
};

function HomePanel({ title, description, href, icon: Icon, accentClass }: PanelProps) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-3xl border border-border bg-bg-panel p-7 transition-all duration-300 hover:-translate-y-1 hover:border-border-light hover:shadow-glow"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5 blur-3xl transition-transform duration-300 group-hover:scale-125" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-surface text-white transition-colors duration-300 group-hover:border-border-light">
          <Icon className="text-[28px]" />
        </div>

        <h2 className="font-heading text-2xl font-bold text-white">{title}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-text-muted">{description}</p>

        <div className="mt-8 text-sm font-medium text-text-main transition-colors duration-200 group-hover:text-white">
          Open
        </div>
      </div>
    </Link>
  );
}

const panels: PanelProps[] = [
  {
    title: 'Videos',
    description: '動画ライブラリを開いて、閲覧と整理を行います。',
    href: '/videos',
    icon: RiMovie2Fill,
    accentClass: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500',
  },
  {
    title: 'Novels',
    description: '小説一覧や読書導線へ入るための入口です。',
    href: '/novels',
    icon: RiBookOpenLine,
    accentClass: 'bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400',
  },
  {
    title: 'Images',
    description: '画像アーカイブ、インポート、タグ付けの起点です。',
    href: '/images',
    icon: RiImageLine,
    accentClass: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-400',
  },
];

const HomePage: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl pt-8">
      <section className="mb-8">
        <h1 className="font-heading text-4xl font-bold text-white">atelier</h1>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {panels.map((panel) => (
          <HomePanel key={panel.title} {...panel} />
        ))}
      </section>
    </div>
  );
};

export default HomePage;
