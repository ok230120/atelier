import React, { ReactNode } from 'react';
import { 
  RiHome5Line, 
  RiMovie2Line, 
  RiFolderSettingsLine, 
  RiHeart3Line, 
  RiSettings4Line 
} from 'react-icons/ri';

// Pages
import HomePage from './home/HomePage';
import VideosPage from './videos/VideosPage';
import VideoDetailPage from './videos/VideoDetailPage';
import ManagePage from './videos/ManagePage';
import FavoritesPage from './favorites/FavoritesPage';
import SettingsPage from './settings/SettingsPage';

export type PageDef = {
  path: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  element: ReactNode;
  isMenu?: boolean; // サイドバーに表示するかどうか
};

export const pageRegistry: PageDef[] = [
  {
    path: "/",
    label: "Home",
    icon: RiHome5Line,
    element: React.createElement(HomePage),
    isMenu: true
  },
  {
    path: "/videos",
    label: "Library",
    icon: RiMovie2Line,
    element: React.createElement(VideosPage),
    isMenu: true
  },
  {
    path: "/favorites",
    label: "Favorites",
    icon: RiHeart3Line,
    element: React.createElement(FavoritesPage),
    isMenu: true
  },
  {
    path: "/manage",
    label: "Manage",
    icon: RiFolderSettingsLine,
    element: React.createElement(ManagePage),
    isMenu: true
  },
  {
    path: "/settings",
    label: "Settings",
    icon: RiSettings4Line,
    element: React.createElement(SettingsPage),
    isMenu: true
  },
  // Hidden routes
  {
    path: "/video/:id",
    label: "Video Player",
    element: React.createElement(VideoDetailPage),
    isMenu: false
  }
];