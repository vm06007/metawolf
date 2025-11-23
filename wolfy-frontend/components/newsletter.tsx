"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "./ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Cross1Icon } from "@radix-ui/react-icons";
import { useIsV0 } from "@/lib/context";
import Image from "next/image";
import { About } from "./about";
import {
    Dialog,
    DialogContent,
} from "./ui/dialog";

// Typewriter component for line-by-line text animation
const TypewriterText = ({
  lines,
  speed = 30,
  pauseAtPunctuation = 500
}: {
  lines: Array<{ text: string; boldParts?: string[]; links?: Array<{ text: string; url: string }> }>,
  speed?: number,
  pauseAtPunctuation?: number
}) => {
  const [displayedLines, setDisplayedLines] = useState<Array<{ text: string; boldParts?: string[]; links?: Array<{ text: string; url: string }> }>>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentLineIndex >= lines.length) return;

    const currentLine = lines[currentLineIndex];
    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < currentLine.text.length) {
        const char = currentLine.text[charIndex];
        setCurrentText(currentLine.text.slice(0, charIndex + 1));

        // Check if character is punctuation
        const isPunctuation = /[.,:;!?]/.test(char);
        const delay = isPunctuation ? pauseAtPunctuation : speed;

        charIndex++;
        timeoutRef.current = setTimeout(typeNextChar, delay);
      } else {
        // Line complete, move to next line after a brief pause
        setDisplayedLines(prev => [...prev, currentLine]);
        setCurrentText("");
        timeoutRef.current = setTimeout(() => {
          setCurrentLineIndex(prev => prev + 1);
        }, 300);
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentLineIndex, lines, speed, pauseAtPunctuation]);

  const renderTextWithFormatting = (text: string, boldParts?: string[], links?: Array<{ text: string; url: string }>) => {
    let result: React.ReactNode[] = [];
    let lastIndex = 0;
    const processedIndices: Array<{ start: number; end: number; type: 'bold' | 'link' }> = [];

    // Collect all formatting positions
    if (boldParts) {
      boldParts.forEach((boldPart) => {
        const index = text.indexOf(boldPart, lastIndex);
        if (index !== -1) {
          processedIndices.push({ start: index, end: index + boldPart.length, type: 'bold' });
        }
      });
    }

    if (links) {
      links.forEach((link) => {
        const index = text.indexOf(link.text);
        if (index !== -1) {
          processedIndices.push({ start: index, end: index + link.text.length, type: 'link' });
        }
      });
    }

    // Sort by start position
    processedIndices.sort((a, b) => a.start - b.start);

    // Remove overlapping (prioritize links over bold)
    const finalIndices: Array<{ start: number; end: number; type: 'bold' | 'link'; content: string }> = [];
    processedIndices.forEach((item) => {
      const overlapping = finalIndices.find(f =>
        (item.start < f.end && item.end > f.start)
      );
      if (!overlapping || item.type === 'link') {
        if (overlapping && item.type === 'link') {
          const idx = finalIndices.indexOf(overlapping);
          finalIndices.splice(idx, 1);
        }
        const content = text.slice(item.start, item.end);
        finalIndices.push({ ...item, content });
      }
    });

    // Build result
    finalIndices.forEach((item, idx) => {
      // Add text before this formatting
      if (item.start > lastIndex) {
        result.push(text.slice(lastIndex, item.start));
      }

      // Add formatted content
      if (item.type === 'bold') {
        result.push(<strong key={`bold-${idx}`}>{item.content}</strong>);
      } else if (item.type === 'link') {
        const link = links?.find(l => l.text === item.content);
        if (link) {
          result.push(
            <a
              key={`link-${idx}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-300 transition-colors"
            >
              {item.content}
            </a>
          );
        } else {
          result.push(item.content);
        }
      }

      lastIndex = item.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result.length > 0 ? result : text;
  };

  return (
    <>
      {displayedLines.map((line, index) => (
        <p key={index}>
          {renderTextWithFormatting(line.text, line.boldParts, line.links)}
        </p>
      ))}
      {currentLineIndex < lines.length && (
        <p>
          {renderTextWithFormatting(currentText, lines[currentLineIndex].boldParts, lines[currentLineIndex].links)}
          <span className="animate-pulse">|</span>
        </p>
      )}
    </>
  );
};

const DURATION = 0.3;
const DELAY = DURATION;
const EASE_OUT = "easeOut";
const EASE_OUT_OPACITY = [0.25, 0.46, 0.45, 0.94] as const;
const SPRING = {
  type: "spring" as const,
  stiffness: 60,
  damping: 10,
  mass: 0.8,
};

export const Newsletter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const isInitialRender = useRef(true);

  useEffect(() => {
    return () => {
      isInitialRender.current = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsAboutOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex overflow-hidden relative flex-col gap-4 justify-center items-center pt-10 w-full h-full short:lg:pt-10 pb-footer-safe-area 2xl:pt-footer-safe-area px-sides short:lg:gap-4 lg:gap-8">
      <motion.div
        layout="position"
        transition={{ duration: DURATION, ease: EASE_OUT }}
        className="flex flex-col items-center gap-6"
      >
        {isOpen ? (
          <h1 className="font-serif text-2xl italic short:lg:text-3xl sm:text-3xl lg:text-4xl text-white">
            Manifesto
          </h1>
        ) : isAboutOpen ? (
          <h1 className="font-serif text-2xl italic short:lg:text-3xl sm:text-3xl lg:text-4xl text-white">
            Introducing Wolfy
          </h1>
        ) : (
          <h1
            className="font-serif text-5xl italic short:lg:text-8xl sm:text-8xl lg:text-9xl text-white"
            style={{
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.448)) drop-shadow(0 4px 12px rgba(0,0,0,0.384)) drop-shadow(0 0 40px rgba(0,0,0,0.32))'
            }}
          >
            Wolfy Wallet
          </h1>
        )}

        {/* Logo - Hide when manifesto or about is open */}
        {!isOpen && !isAboutOpen && (
          <motion.div
            initial={isInitialRender.current ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: DURATION,
              ease: EASE_OUT,
              delay: DELAY,
            }}
            className="relative w-24 h-24 short:lg:w-32 short:lg:h-32 sm:w-32 sm:h-32 lg:w-40 lg:h-40"
          >
            <Image
              src="/wolf-logo.png"
              alt="Wolfy Wallet Logo"
              fill
              className="object-contain"
              style={{
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.448)) drop-shadow(0 4px 12px rgba(0,0,0,0.384)) drop-shadow(0 0 40px rgba(0,0,0,0.32))'
              }}
              priority
            />
          </motion.div>
        )}
      </motion.div>

      <div className="flex flex-col items-center min-h-0 shrink w-full max-w-full">
        <AnimatePresenceGuard>
          {/* Buttons - Hide when manifesto or about is open */}
          {!isOpen && !isAboutOpen && (
            <motion.div
              key="buttons"
              initial={isInitialRender.current ? false : "hidden"}
              animate="visible"
              exit="exit"
              variants={{
                visible: {
                  scale: 1,
                  transition: {
                    delay: DELAY,
                    duration: DURATION,
                    ease: EASE_OUT,
                  },
                },
                hidden: {
                  scale: 0.9,
                  transition: { duration: DURATION, ease: EASE_OUT },
                },
                exit: {
                  y: -150,
                  scale: 0.9,
                  transition: { duration: DURATION, ease: EASE_OUT },
                },
              }}
              className="flex flex-row gap-4 items-center"
            >
              <Button
                className={cn("relative px-6 py-3 backdrop-blur-md bg-white/20 border-white/40 text-white hover:bg-white/30 hover:border-white/60 transition-all duration-300 shadow-lg hover:shadow-xl")}
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3)) drop-shadow(0 4px 16px rgba(0,0,0,0.2))',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.1)'
                }}
                onClick={() => {
                  setIsAboutOpen(false);
                  setIsOpen(!isOpen);
                }}
                shine={!isOpen}
              >
                Manifesto
              </Button>

              <Button
                className={cn("relative px-6 py-3 backdrop-blur-md bg-white/20 border-white/40 text-white hover:bg-white/30 hover:border-white/60 transition-all duration-300 shadow-lg hover:shadow-xl")}
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3)) drop-shadow(0 4px 16px rgba(0,0,0,0.2))',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.1)'
                }}
                onClick={() => {
                  setIsOpen(false);
                  setIsAboutOpen(true);
                }}
              >
                About
              </Button>

              <Button
                className={cn("relative px-6 py-3 backdrop-blur-md bg-white/20 border-white/40 text-white hover:bg-white/30 hover:border-white/60 transition-all duration-300 shadow-lg hover:shadow-xl")}
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3)) drop-shadow(0 4px 16px rgba(0,0,0,0.2))',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.1)'
                }}
                onClick={() => {
                  setIsVideoOpen(true);
                }}
              >
                See Demo
              </Button>
            </motion.div>
          )}

          {/* Manifesto Window - Show when open, positioned right under title */}
          {isOpen && (
            <motion.div
              key="manifesto"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{
                visible: {
                  opacity: 1,
                  scale: 1,
                  transition: {
                    delay: DELAY,
                    duration: DURATION,
                    ease: EASE_OUT,
                  },
                },
                hidden: {
                  opacity: 0,
                  scale: 0.9,
                  transition: { duration: DURATION, ease: EASE_OUT },
                },
                exit: {
                  opacity: 0,
                  scale: 0.9,
                  transition: { duration: DURATION, ease: EASE_OUT_OPACITY },
                },
              }}
              className="relative flex min-h-0 flex-shrink overflow-hidden text-base md:text-lg lg:text-xl w-full max-w-full flex-col gap-8 text-left backdrop-blur-xl text-balance border-2 border-white/30 bg-black/70 text-white rounded-3xl ring-1 ring-offset-white/20 ring-white/30 ring-offset-2 shadow-button mt-2 h-[calc(100vh-8rem)]"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="Close manifesto"
              >
                <Cross1Icon className="w-4 h-4 text-white" />
              </button>

              <article className="relative overflow-y-auto italic px-8 md:px-10 lg:px-12 pb-8 md:pb-10 lg:pb-12 pt-0 h-full [&_p]:my-4 text-left [&_strong]:text-white [&_strong]:font-semibold">
                {isOpen && (
                  <TypewriterText
                    lines={[
                      { text: "November 23, 2025", boldParts: ["November 23, 2025"] },
                      { text: "Restate my assumptions:" },
                      { text: "1. Rabby is one of the best web3 wallets of all time.", boldParts: ["1."] },
                      { text: "2. Everything in blockchain can be represented and understood through EIPs.", boldParts: ["2."] },
                      { text: "3. Rabby still doesn't support EIP-7702.", boldParts: ["3."] },
                      {
                        text: "Therefore: Rabby belongs on the wall of shame.",
                        boldParts: ["Therefore:"],
                        links: [{ text: "the wall of shame", url: "https://swiss-knife.xyz/7702beat#wall-of-shame" }]
                      },
                      { text: "---" },
                      { text: "At DevConnect, we made a promise:" },
                      { text: "If Rabby remained non-compliant with EIP-7702 before hackathon, we will implement during ETHGlobal Buenos Aires." },
                      { text: "They didn't." },
                      { text: "So we hacked it." },
                    ]}
                    speed={30}
                    pauseAtPunctuation={500}
                  />
                )}
              </article>
            </motion.div>
          )}

          {/* About Window - Show when about is open */}
          {isAboutOpen && (
            <About onClose={() => setIsAboutOpen(false)} />
          )}
        </AnimatePresenceGuard>
      </div>

      {/* Social Media Icons - Hide when manifesto or about is open */}
      {!isOpen && !isAboutOpen && (
        <motion.div
          initial={isInitialRender.current ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: DURATION,
            ease: EASE_OUT,
            delay: DELAY * 1.5,
          }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 items-center"
        >
          <a
            href="https://x.com/EthVitally"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/vm06007/metawolf"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </a>
          <a
            href="https://ethglobal.com/showcase/wolfy-r87tb"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/50 transition-colors"
            aria-label="ETHGlobal Showcase"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </a>
        </motion.div>
      )}

      {/* Video Demo Modal */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-4xl w-full bg-black/90 border-white/30 p-0 backdrop-blur-xl">
          <div className="relative w-full aspect-video">
            <video
              src="https://ethglobal.storage/projects/r87tb/video/high.mp4?t=1763892727499"
              controls
              autoPlay
              className="w-full h-full rounded-lg"
              style={{ maxHeight: '90vh' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AnimatePresenceGuard = ({ children }: { children: React.ReactNode }) => {
  const isV0 = useIsV0();

  return isV0 ? <>{children}</> : <AnimatePresence mode="popLayout" propagate>{children}</AnimatePresence>;
};
