"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Cross1Icon } from "@radix-ui/react-icons";

// Simplified Section component
const Section = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return (
    <div className={`relative ${className || ""}`}>
      {children}
    </div>
  );
};

// Simplified Button component
const Button = ({ className, onClick, children }: { className?: string; onClick?: () => void; children: React.ReactNode }) => {
  return (
    <button
      className={`relative inline-flex items-center justify-center h-11 px-7 transition-colors hover:text-gray-300 text-white border border-white/20 rounded-full backdrop-blur-sm bg-white/10 hover:bg-white/20 ${className || ""}`}
      onClick={onClick}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

// Collaboration content from brainwave
const collabContent = [
  {
    id: "0",
    title: "Rabby + EIP-7702 Support",
    description: "Transform your EOA into a smart contract account - Transaction bundling, gas sponsorship, and custom permissions",
  },
  {
    id: "1",
    title: "Arx Halo & Firefly Support",
    description: "Tap to pay with NFC hardware. Coffee, groceries, real world transactions.",
  },
  {
    id: "2",
    title: "Built-In Multisig ",
    description: "Enhanced securiry, shared accounts, team treasury.",
  },
  {
    id: "3",
    title: "HTTP 402 Payment",
    description: "Subscribe to music, magazines, and entertainment with native token payments.",
  },
  {
    id: "4",
    title: "Cross-Chain EVM/BTC Payments",
    description: "Pay with BTC and LTC through Citrea integration.",
  },
];

const collabApps = [
  { id: "0", title: "Chainlink", icon: "/collaboration/chainlink.png", width: 26, height: 36 },
  { id: "1", title: "MetaMask", icon: "/collaboration/MetaMask.png", width: 34, height: 36 },
  { id: "2", title: "Avail", icon: "/collaboration/avil-logo.png", width: 36, height: 28 },
  { id: "3", title: "Firefly", icon: "/collaboration/firefly-logo.png", width: 34, height: 35 },
  { id: "4", title: "Octav", icon: "/collaboration/octav-logo.png", width: 34, height: 34 },
  { id: "5", title: "Rabby", icon: "/collaboration/rabby-logo.png", width: 34, height: 34 },
  { id: "6", title: "x402", icon: "/collaboration/x402-logo.png", width: 26, height: 34 },
  { id: "7", title: "Zircuit", icon: "/collaboration/zircuit-logo.png", width: 38, height: 32 },
];

export const About = ({ onClose }: { onClose: () => void }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="relative flex min-h-0 flex-shrink overflow-hidden text-base md:text-lg lg:text-xl w-full max-w-full flex-col gap-8 text-left backdrop-blur-xl text-balance border-2 border-white/30 bg-black/70 text-white rounded-3xl ring-1 ring-offset-white/20 ring-white/30 ring-offset-2 shadow-button mt-2 h-[calc(100vh-4rem)] z-20"
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
        aria-label="Close about"
      >
        <Cross1Icon className="w-4 h-4 text-white" />
      </button>

      <div className="relative overflow-y-auto px-8 md:px-10 lg:px-12 pb-8 md:pb-10 lg:pb-12 pt-0 h-full">
        <Section className="py-10 lg:py-16 xl:py-20">
          <div className="container lg:flex lg:gap-12">
            <div className="flex-1 lg:max-w-none xl:max-w-[60rem] w-full">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-8 text-white">
                The Ultimate Smart Wallet
              </h2>
              <ul className="w-full mb-10 md:mb-14">
                {collabContent.map((item) => {
                  const isExpanded = expandedItems.has(item.id);
                  return (
                    <li className="mb-3 py-3 cursor-pointer" key={item.id} onClick={() => toggleItem(item.id)}>
                      <div className="flex items-center">
                        <div className="scale-[1.8]">🐺</div>
                        <h6 className="text-lg font-semibold ml-5 text-white flex-1">{item.title}</h6>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                          className="ml-2"
                        >
                          <svg
                            className="w-5 h-5 text-white"
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
                        </motion.div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && item.description && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <p className="text-base mt-3 ml-[3.5rem] text-gray-400 max-w-[45rem]">
                              {item.description}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>

              <Button onClick={() => window.open("https://github.com/vm06007/metawolf", "_blank", "noopener,noreferrer")}>Try it now</Button>
            </div>

            <div className="lg:ml-auto xl:w-[38rem] mt-4">
              <div className="relative left-1/2 flex w-[22rem] aspect-square border border-white/30 rounded-full -translate-x-1/2 scale-75 md:scale-100">
                <div className="flex w-90 aspect-square m-auto border border-white/30 rounded-full">
                  <div className="w-[9rem] aspect-square m-auto p-[0.2rem] bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full">
                    <div className="flex items-center justify-center w-full h-full bg-black rounded-full">
                      <Image
                        src="/wolf-logo.png"
                        width={120}
                        height={120}
                        alt="wolfy"
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>

                <ul
                  className="absolute inset-0"
                  style={{
                    animation: 'rotate-wheel 20s linear infinite'
                  }}
                >
                  {collabApps.map((app, index) => (
                    <li
                      key={app.id}
                      className={`absolute top-0 left-1/2 h-1/2 -ml-[1.6rem] origin-bottom`}
                      style={{ transform: `rotate(${index * 45}deg)` }}
                    >
                      <div
                        className="relative -top-[1.6rem]"
                        style={{
                          transform: `rotate(-${index * 45}deg)`,
                        }}
                      >
                        <div
                          className={`flex items-center justify-center w-[3.2rem] h-[3.2rem] bg-black/50 border border-white/15 rounded-full overflow-hidden`}
                          style={{
                            animation: 'counter-rotate-logo 20s linear infinite'
                          }}
                        >
                          <Image
                            className="object-contain w-full h-full"
                            width={app.width}
                            height={app.height}
                            alt={app.title}
                            src={app.icon}
                            style={{ transform: 'scale(1.3)' }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </motion.div>
  );
};

