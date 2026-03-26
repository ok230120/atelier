// FILE: src/pages/novels/components/NovelContent.tsx
import React, { useRef, useEffect } from 'react';

interface NovelContentProps {
  content: string;
  fontSize?: number;
}

const NovelContent: React.FC<NovelContentProps> = ({ content, fontSize = 16 }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // ページ遷移時にスクロール位置をリセット
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [content]);

  return (
    <div
      ref={contentRef}
      className="flex-1 overflow-y-auto px-8 py-8 sm:px-12 md:px-16 lg:px-24"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: 1.8,
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="font-body text-text-main whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
};

export default NovelContent;