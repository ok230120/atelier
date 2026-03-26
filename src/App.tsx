import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import classNames from 'classnames';
import { pageRegistry } from './pages/registry';
import Sidebar from './components/Sidebar';

function AppContent() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // 小説閲覧ページかどうかを判定
  const isNovelReaderPage = /^\/novels\/[^/]+\/\d+$/.test(location.pathname);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-main relative">
      <Sidebar 
        isOverlay={isNovelReaderPage} 
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
      />

      {/* Main Content Area */}
      <div 
        className="flex flex-1 flex-col relative min-w-0 transition-all duration-300"
        style={{
          /**
           * ここを修正：
           * 小説ページであれば、サイドバーが開いていても閉じていても
           * 常に「72px」の左余白を維持します。
           * * これにより：
           * 1. 閉じている時(72px): サイドバー(72px)とコンテンツがピッタリ並ぶ。
           * 2. 開いた時(256px): コンテンツの位置(72px地点)は動かず、
           * サイドバーだけがその上に被さってくる。
           */
          paddingLeft: isNovelReaderPage ? '72px' : '0px',
        }}
      >
        <main 
          className={classNames(
            "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border-light scrollbar-track-transparent transition-all duration-300",
            isNovelReaderPage ? "p-0" : "p-6"
          )}
        >
          <Routes>
            {/* Registry based routes */}
            {pageRegistry.map((page) => (
              <Route key={page.path} path={page.path} element={page.element} />
            ))}
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;