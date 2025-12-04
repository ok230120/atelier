import React from 'react';
import { Link } from 'react-router-dom';
import { RiMovie2Fill, RiBookOpenLine, RiToolsLine } from 'react-icons/ri';

const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 max-w-6xl mx-auto pt-8">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-10">
        <h1 className="font-heading text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-text-main to-text-muted">
          Welcome back.
        </h1>
        <p className="text-text-muted text-lg max-w-2xl mx-auto font-light">
          Your personal digital sanctuary. Access your library, tools, and archives from one place.
        </p>
      </section>

      {/* Modules Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Videos Module Card */}
        <Link to="/videos" className="group relative bg-bg-panel border border-border rounded-2xl p-6 overflow-hidden hover:border-accent/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-32 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent/10 transition-all" />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-12 h-12 bg-bg-surface rounded-xl border border-border flex items-center justify-center mb-6 group-hover:border-accent/50 group-hover:text-accent transition-colors">
              <RiMovie2Fill className="text-2xl" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">Video Library</h3>
            <p className="text-text-muted text-sm mb-6 flex-1">
              Manage and watch your local video collection with advanced tagging and organization.
            </p>
            <span className="text-accent text-sm font-medium flex items-center gap-2">
              Open Library &rarr;
            </span>
          </div>
        </Link>

        {/* Novels Module Placeholder */}
        <div className="bg-bg-panel/50 border border-border/50 rounded-2xl p-6 relative overflow-hidden opacity-60">
          <div className="absolute top-4 right-4 px-2 py-1 bg-bg text-text-dim text-[10px] uppercase tracking-wider font-bold rounded border border-border">Coming Soon</div>
          <div className="w-12 h-12 bg-bg-surface/50 rounded-xl border border-border/50 flex items-center justify-center mb-6 text-text-dim">
            <RiBookOpenLine className="text-2xl" />
          </div>
          <h3 className="font-heading text-xl font-bold mb-2 text-text-muted">Novels</h3>
          <p className="text-text-dim text-sm">
            A quiet reader for your text archives and web novels.
          </p>
        </div>

        {/* Tools Module Placeholder */}
        <div className="bg-bg-panel/50 border border-border/50 rounded-2xl p-6 relative overflow-hidden opacity-60">
          <div className="absolute top-4 right-4 px-2 py-1 bg-bg text-text-dim text-[10px] uppercase tracking-wider font-bold rounded border border-border">Coming Soon</div>
          <div className="w-12 h-12 bg-bg-surface/50 rounded-xl border border-border/50 flex items-center justify-center mb-6 text-text-dim">
            <RiToolsLine className="text-2xl" />
          </div>
          <h3 className="font-heading text-xl font-bold mb-2 text-text-muted">Tools</h3>
          <p className="text-text-dim text-sm">
            Utilities, converters, and scripts for daily tasks.
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
