export class AppRouter {
    constructor(routes) {
        this.routes = routes; // Map of 'path' -> PageClass
        this.currentPage = null;
        this.container = document.getElementById('app-content');

        // Listen for navigation events
        window.addEventListener('hashchange', () => this.handleRoute());

        // Handle initial route
        this.handleRoute();
    }

    navigate(path) {
        window.location.hash = path;
    }

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard'; // Default to dashboard
        const routeData = this.matchRoute(hash);

        if (routeData) {
            this.renderPage(routeData);
            this.updateSidebar(hash);
        } else {
            console.error('Route not found:', hash);
            this.navigate('dashboard');
        }
    }

    matchRoute(path) {
        // Simple matching for now, can support params later if needed
        // e.g., model-builder/123 -> regex

        // Direct match
        if (this.routes[path]) {
            return { pageClass: this.routes[path], params: {} };
        }

        // Check for parameterized routes (simple prefix check for now)
        // e.g. project-viewer?id=123 handled by search params
        // hash: project-viewer/123

        for (const route in this.routes) {
            if (path.startsWith(route + '/')) { // e.g. 'project-viewer/'
                const param = path.split('/')[1];
                return { pageClass: this.routes[route], params: { id: param } };
            }
        }

        return null;
    }

    renderPage({ pageClass, params }) {
        if (this.currentPage) {
            if (this.currentPage.destroy) this.currentPage.destroy();
        }

        this.container.innerHTML = ''; // Clear content
        this.currentPage = new pageClass(this.container, params);
    }

    updateSidebar(activeHash) {
        const links = document.querySelectorAll('.sidebar a');
        links.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeHash.split('/')[0]}`) {
                link.classList.add('active');
            }
        });
    }
}
