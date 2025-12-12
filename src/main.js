import './style.css';
import { AppRouter } from './core/AppRouter.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewProjectPage } from './pages/NewProjectPage.js';
import { ModelBuilderPage } from './pages/ModelBuilderPage.js';
import { ProjectViewerPage } from './pages/ProjectViewerPage.js';

// Define Routes
const routes = {
  'dashboard': DashboardPage,
  'new-project': NewProjectPage,
  'model-builder': ModelBuilderPage,
  'project-viewer': ProjectViewerPage // Handles project-viewer/:id
};

// Initialize Router
const router = new AppRouter(routes);

console.log('Application Initialized with Router');
