'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Package, BarChart3, TrendingUp, Home } from 'lucide-react';

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/inventory', label: '재고 배분', icon: Package },
  { href: '/gmv', label: 'GMV', icon: TrendingUp },
  { href: '/sales', label: '판매 분석', icon: BarChart3 },
];

const countries = [
  { code: 'TW', label: '대만', flag: '🇹🇼' },
  { code: 'HK', label: '홍콩', flag: '🇭🇰' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCountry = searchParams.get('country') || 'TW';

  function buildHref(path: string) {
    return `${path}?country=${currentCountry}`;
  }

  return (
    <aside className="w-56 bg-white border-r min-h-screen p-4 flex flex-col">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900">Sister Ann</h1>
        <p className="text-xs text-gray-500">이커머스 대시보드</p>
      </div>

      {/* 국가 선택 */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-2 px-3">국가 선택</p>
        <div className="flex gap-1">
          {countries.map((c) => {
            const isActive = currentCountry === c.code;
            return (
              <Link
                key={c.code}
                href={`${pathname}?country=${c.code}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
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
