"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CodepunkHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="relative z-50 px-6 py-4">
            <nav className="mx-auto flex max-w-7xl items-center justify-between">
                {/* Logo */}
                <Link href="/codepunk" className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-black font-bold text-sm">
                        CP
                    </div>
                    <span className="text-white font-bold text-lg">CODEPUNK</span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-8">
                    <div className="relative">
                        <button className="flex items-center space-x-1 text-white hover:text-gray-300 transition-colors">
                            <span>MENU</span>
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="relative">
                        <button className="flex items-center space-x-1 text-white hover:text-gray-300 transition-colors">
                            <span>PAGES</span>
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                    </div>

                    <Link
                        href="/integrations"
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        INTEGRATIONS
                    </Link>

                    <Link
                        href="/pricing"
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        PRICING
                    </Link>

                    <Link
                        href="/blog"
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        BLOG
                    </Link>
                </div>

                {/* CTA Button */}
                <div className="hidden md:block">
                    <Button
                        variant="ghost"
                        className="!rounded-lg bg-transparent border border-white text-white hover:bg-white hover:text-black transition-colors px-6 py-2"
                    >
                        GET TEMPLATE
                    </Button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-white"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <svg
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {isMenuOpen ? (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        ) : (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        )}
                    </svg>
                </button>
            </nav>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="absolute top-full left-0 right-0 bg-[#0a0a0a] border-t border-gray-800 md:hidden">
                    <div className="px-6 py-4 space-y-4">
                        <Link
                            href="/menu"
                            className="block text-white hover:text-gray-300 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            MENU
                        </Link>
                        <Link
                            href="/pages"
                            className="block text-white hover:text-gray-300 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            PAGES
                        </Link>
                        <Link
                            href="/integrations"
                            className="block text-white hover:text-gray-300 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            INTEGRATIONS
                        </Link>
                        <Link
                            href="/pricing"
                            className="block text-white hover:text-gray-300 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            PRICING
                        </Link>
                        <Link
                            href="/blog"
                            className="block text-white hover:text-gray-300 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            BLOG
                        </Link>
                        <Button
                            variant="ghost"
                            className="w-full !rounded-lg bg-transparent border border-white text-white hover:bg-white hover:text-black transition-colors"
                        >
                            GET TEMPLATE
                        </Button>
                    </div>
                </div>
            )}
        </header>
    );
}
