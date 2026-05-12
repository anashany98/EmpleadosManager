import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { navItems } from '../sidebarNavigation';

interface Crumb {
  path: string;
  label: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === '/') return [];

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const navItem = navItems.find(item => item.path === currentPath);
    crumbs.push({
      path: currentPath,
      label: navItem?.label || segment
    });
  }

  return crumbs;
}

export function Breadcrumbs() {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        to="/"
        className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Home size={14} aria-hidden="true" />
        <span className="sr-only">Inicio</span>
      </Link>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;

        return (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
            {isLast ? (
              <span className="font-semibold text-slate-900 dark:text-white" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}