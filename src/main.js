import './style.css';
import { ModelBuilderPage } from './pages/ModelBuilderPage.js';
import { AssemblerLoginPage } from './pages/AssemblerLoginPage.js';
import { AssemblerViewerPage } from './pages/AssemblerViewerPage.js';

// Basic Router
// Target the main content area, preserving the sidebar in index.html
const app = document.querySelector('#app-content');

if (!app) {
    console.error("Critical: #app-content not found in DOM");
    // Fallback if index.html is messed up
    document.body.innerHTML = '<div id="app" style="height:100vh;"></div>';
}

const container = app || document.querySelector('#app');

const routes = {
    '': () => new ModelBuilderPage(container, { view: 'projects' }),
    'dashboard': () => new ModelBuilderPage(container, { view: 'projects' }), // Admin Dashboard (Projects)
    'new-project': () => new ModelBuilderPage(container, { view: 'new' }), // Create New
    'model-builder': (id) => {
        // If ID is present, we edit. If not, we list templates (Admin view)
        if (id && id !== 'new') return new ModelBuilderPage(container, { id });
        if (id === 'new') return new ModelBuilderPage(container, { id: 'new' }); // Handle 'new' param internally for empty editor?

        // No ID -> List Templates
        return new ModelBuilderPage(container, { view: 'templates' });
    },
    'assembler': (id) => {
        // Assembler view might want full screen, overlaying sidebar?
        // If so, we might need to hide sidebar.
        // But for now, let's render inside content.
        if (id) return new AssemblerViewerPage(container, { id });
        return new AssemblerLoginPage(container);
    }
};

async function router() {
    const hash = window.location.hash.slice(1) || '';
    const [path, param] = hash.split('/');

    // Handle Sidebar Visibility
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (path === 'assembler') {
            sidebar.style.display = 'none'; // Hide sidebar for assembler
        } else {
            sidebar.style.display = 'flex'; // Show for admin
        }
    }

    // Cleanup previous page
    if (window.currentPage && window.currentPage.destroy) {
        window.currentPage.destroy();
    }
    container.innerHTML = '';

    if (routes[path]) {
        window.currentPage = routes[path](param);
    } else if (path === 'assembler') {
        window.currentPage = routes['assembler'](param);
    } else {
        window.currentPage = new ModelBuilderPage(container); // Default
    }

    // update active link
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-links a[href="#${path}"]`);
    if (activeLink) activeLink.classList.add('active');
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

console.log('Application Initialized with Router');
