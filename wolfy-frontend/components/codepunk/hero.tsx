"use client";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/codepunk/code-editor";

export function CodepunkHero() {
    return (
        <section className="px-6 py-16 md:py-24">
            <div className="mx-auto max-w-7xl">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Left Content */}
                    <div className="space-y-8">
                        {/* Watch Event Badge */}
                        <div className="inline-flex items-center space-x-2 text-sm text-gray-400">
                            <span>| Watch our event</span>
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
                                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                                />
                            </svg>
                        </div>

                        {/* Main Heading */}
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                Build new products<br />
                                for <span className="text-[#adff85]">startups</span>
                            </h1>
                            
                            <p className="text-lg md:text-xl text-gray-400 max-w-lg">
                                Our framework component is built to handle scaling demands 
                                with agility. Lightning-fast performance is our promise.
                            </p>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button 
                                className="!rounded-lg bg-[#adff85] text-black hover:bg-[#9ff570] transition-colors px-8 py-3 font-semibold text-base h-12"
                            >
                                GET STARTED
                                <svg
                                    className="ml-2 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                                    />
                                </svg>
                            </Button>
                            
                            <Button 
                                variant="ghost" 
                                className="!rounded-lg bg-transparent border border-gray-400 text-white hover:bg-gray-800 hover:border-gray-300 transition-colors px-8 py-3 font-semibold text-base h-12"
                            >
                                LEARN MORE
                                <svg
                                    className="ml-2 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                                    />
                                </svg>
                            </Button>
                        </div>
                    </div>

                    {/* Right Content - Code Editor */}
                    <div className="lg:pl-8">
                        <CodeEditor />
                    </div>
                </div>
            </div>
        </section>
    );
}
