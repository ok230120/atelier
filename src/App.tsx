
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { pageRegistry } from './pages/registry';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-main">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col relative min-w-0">
          <Topbar />
          
          <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border-light scrollbar-track-transparent">
            <Routes>
              {/* Registry based routes */}
              {pageRegistry.map((page) => (
                <Route key={page.path} path={page.path} element={page.element} />
              ))}
              
              {/* Fallback to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
