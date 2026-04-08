
import React from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon } from '../../Icons';

interface PaginationFooterProps {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    pageInfo: string;
    onNextPage: () => void;
    onPrevPage: () => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
    isLoading?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const PaginationFooter: React.FC<PaginationFooterProps> = ({
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
    pageInfo,
    onNextPage,
    onPrevPage,
    onPageSizeChange,
    pageSizeOptions = PAGE_SIZE_OPTIONS,
    isLoading = false,
}) => {
    if (total === 0) return null;

    return (
        <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Left: Page info */}
            <div className="flex items-center gap-3">
                <span className={`text-xs font-medium transition-opacity ${isLoading ? 'text-gray-600 opacity-60' : 'text-gray-400'}`}>
                    {pageInfo}
                </span>
                {totalPages > 1 && (
                    <span className="text-[10px] text-gray-600 font-mono">
                        Page {page + 1} of {totalPages}
                    </span>
                )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3">
                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Per page</span>
                    <div className="relative">
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="bg-gray-800 border border-gray-700 text-gray-300 text-[11px] rounded-md px-2 py-1 outline-none focus:border-cyan-500 appearance-none pr-6 cursor-pointer font-mono"
                        >
                            {pageSizeOptions.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-1 flex items-center pointer-events-none text-gray-500">
                            <ChevronDownIcon size={10} />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrevPage}
                        disabled={!hasPrevPage || isLoading}
                        className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Previous page"
                    >
                        <ArrowLeftIcon size={14} />
                    </button>
                    <button
                        onClick={onNextPage}
                        disabled={!hasNextPage || isLoading}
                        className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Next page"
                    >
                        <ArrowRightIcon size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
