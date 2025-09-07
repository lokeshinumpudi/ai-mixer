"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MobileScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  showIndicators?: boolean;
  itemCount?: number;
  itemIds?: string[]; // Optional array of unique IDs for better keys
}

export function MobileScrollContainer({
  children,
  className,
  showIndicators = true,
  itemCount = 0,
  itemIds = [],
}: MobileScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Check scroll position and update indicators
  const checkScrollPosition = () => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    // Calculate active index based on scroll position
    const cardWidth = scrollRef.current.clientWidth * 0.8; // 80vw per card
    const newIndex = Math.round(scrollLeft / (cardWidth + 16)); // 16px gap
    setActiveIndex(Math.min(newIndex, itemCount - 1));
  };

  // Scroll to specific card
  const scrollToCard = (index: number) => {
    if (!scrollRef.current) return;

    const cardWidth = scrollRef.current.clientWidth * 0.8;
    const scrollPosition = index * (cardWidth + 16);

    scrollRef.current.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    checkScrollPosition();
    scrollElement.addEventListener("scroll", checkScrollPosition);
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      scrollElement.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, [itemCount]);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory",
          "scrollbar-thin scrollbar-thumb-muted/50 scrollbar-track-transparent",
          // Ensure horizontal scroll stays contained
          "w-full min-w-0",
          // Webkit scrollbar styles for better mobile support
          "[&::-webkit-scrollbar]:h-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-muted/50",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb:hover]:bg-muted/70",
          className
        )}
        style={{
          // Hide scrollbar on mobile while keeping functionality
          scrollbarWidth: "thin",
          WebkitOverflowScrolling: "touch",
          // Ensure the container doesn't expand beyond viewport
          maxWidth: "calc(100vw - 16px)", // Account for container padding
        }}
      >
        {children}
      </div>

      {/* Left scroll button - positioned at top for variable height content */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollToCard(Math.max(0, activeIndex - 1))}
          className="absolute left-2 top-4 z-10 bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-lg hover:bg-background/90 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Right scroll button - positioned at top for variable height content */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollToCard(Math.min(itemCount - 1, activeIndex + 1))}
          className="absolute right-2 top-4 z-10 bg-background/80 backdrop-blur-sm border rounded-full p-2 shadow-lg hover:bg-background/90 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Scroll indicators */}
      {showIndicators && itemCount > 1 && (
        <div className="flex justify-center mt-3 gap-2">
          <div className="flex gap-1">
            {Array.from({ length: itemCount }, (_, index) => (
              <button
                key={
                  itemIds[index]
                    ? `indicator-${itemIds[index]}`
                    : `scroll-indicator-${itemCount}-${index}`
                }
                type="button"
                onClick={() => scrollToCard(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors duration-200",
                  index === activeIndex
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>

          {/* Swipe hint */}
          <div className="ml-3 text-xs text-muted-foreground flex items-center gap-1">
            <span>Swipe</span>
            <svg className="w-3 h-3" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 4h10M8 1l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
