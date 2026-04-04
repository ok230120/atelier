// FILE: src/pages/registry.ts
import React, { ReactNode } from 'react';
import {
  RiHome5Line,
  RiMovie2Line,
  RiFolderSettingsLine,
  RiHeart3Line,
  RiImageAddLine,
  RiPriceTag3Line,
  RiSettings4Line,
  RiBookOpenLine,
  RiImageLine,
} from 'react-icons/ri';

// 既存のインポート
import HomePage from './home/HomePage';
import VideosPage from './videos/VideosPage';
import VideoDetailPage from './videos/VideoDetailPage';
import ManagePage from './videos/ManagePage';
import FavoritesPage from './favorites/FavoritesPage';
import SettingsPage from './settings/SettingsPage';

// 小説ページのインポート
import NovelsPage from './novels/NovelsPage';
import NovelEditorPage from './novels/NovelEditorPage';
import NovelReaderPage from './novels/NovelReaderPage';
import NovelManagePage from './novels/NovelManagePage';
import SeriesDetailPage from './novels/SeriesDetailPage';
import NovelFavoritesPage from './novels/NovelFavoritesPage';
import ImagesPage from './images/ImagesPage';
import ImageDetailPage from './images/ImageDetailPage';
import ImageManagePage from './images/ImageManagePage';
import ImageImportPage from './images/ImageImportPage';
import ImageTaggingPage from './images/ImageTaggingPage';
import ImageTagsPage from './images/ImageTagsPage';

export type PageDef = {
  path: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  element: ReactNode;
  isMenu?: boolean;
};

export const pageRegistry: PageDef[] = [
  {
    path: '/',
    label: 'Home',
    icon: RiHome5Line,
    element: React.createElement(HomePage),
    isMenu: true,
  },
  {
    path: '/videos',
    label: 'Library',
    icon: RiMovie2Line,
    element: React.createElement(VideosPage),
    isMenu: true,
  },
  {
    path: '/novels',
    label: 'Novels',
    icon: RiBookOpenLine,
    element: React.createElement(NovelsPage),
    isMenu: true,
  },
  {
    path: '/novels/favorites',
    label: 'Favorite Novels',
    icon: RiHeart3Line,
    element: React.createElement(NovelFavoritesPage),
    isMenu: true,
  },
  {
    path: '/novels/manage',
    label: 'Novel Management',
    icon: RiFolderSettingsLine,
    element: React.createElement(NovelManagePage),
    isMenu: true,
  },
  {
    path: '/images',
    label: 'Images',
    icon: RiImageLine,
    element: React.createElement(ImagesPage),
    isMenu: true,
  },
  {
    path: '/favorites',
    label: 'Favorites',
    icon: RiHeart3Line,
    element: React.createElement(FavoritesPage),
    isMenu: true,
  },
  {
    path: '/manage',
    label: 'Manage',
    icon: RiFolderSettingsLine,
    element: React.createElement(ManagePage),
    isMenu: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: RiSettings4Line,
    element: React.createElement(SettingsPage),
    isMenu: true,
  },
  // Hidden routes
  {
    path: '/video/:id/view',
    label: 'Video Player',
    element: React.createElement(VideoDetailPage),
    isMenu: false,
  },
  {
    path: '/images/manage',
    label: 'Image Manage',
    icon: RiFolderSettingsLine,
    element: React.createElement(ImageManagePage),
    isMenu: true,
  },
  {
    path: '/images/import',
    label: 'Image Import',
    icon: RiImageAddLine,
    element: React.createElement(ImageImportPage),
    isMenu: true,
  },
  {
    path: '/images/tagging',
    label: 'Tagging',
    icon: RiPriceTag3Line,
    element: React.createElement(ImageTaggingPage),
    isMenu: true,
  },
  {
    path: '/images/tags',
    label: 'Tags',
    icon: RiPriceTag3Line,
    element: React.createElement(ImageTagsPage),
    isMenu: true,
  },
  {
    path: '/images/view/:id',
    label: 'Image Detail',
    element: React.createElement(ImageDetailPage),
    isMenu: false,
  },
  {
    path: '/novels/:id/:page',
    label: 'Novel Reader',
    element: React.createElement(NovelReaderPage),
    isMenu: false,
  },
  {
    path: '/novels/edit/:id?',
    label: 'Novel Editor',
    element: React.createElement(NovelEditorPage),
    isMenu: false,
  },
  {
    path: '/novels/series/:id',
    label: 'Series Detail',
    element: React.createElement(SeriesDetailPage),
    isMenu: false,
  },
];
