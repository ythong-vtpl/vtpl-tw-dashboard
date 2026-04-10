'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, BarChart3, TrendingUp, Home } from 'lucide-react';

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/inventory', label: '재고 배분', icon: Package },
  { href: '/gmv', label: 'GMV', icon: TrendingUp },
  { href: '/sales', label: '판매 분석', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-gray-900">Sister Ann TW</h1>
        <p className="text-xs text-gray-500">대만 이커머스 대시보드</p>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
