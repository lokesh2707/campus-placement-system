import React from "react";
import { GraduationCap } from "lucide-react";

/**
 * High-definition SVG spinner for buttons and inline async states.
 */
export const Spinner = ({
  className = "w-5 h-5 text-teal",
  size = 20,
  strokeWidth = 3,
  ...props
}) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle
      className="opacity-20"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    />
    <path
      className="opacity-90"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Compact button spinner for actions (e.g. Save Profile, Submit).
 */
export const ButtonSpinner = ({ className = "w-4 h-4 text-white" }) => (
  <Spinner className={className} size={16} strokeWidth={3.5} />
);

/**
 * Branded PageLoader for React Suspense fallbacks and route transitions.
 */
export const PageLoader = ({
  label = "Loading page...",
  subtitle = "Preparing your placement workspace...",
  fullScreen = false,
}) => (
  <div
    className={`${
      fullScreen ? "min-h-screen" : "min-h-[50vh]"
    } flex items-center justify-center p-6 bg-paper select-none`}
    role="status"
    aria-live="polite"
  >
    <div className="panel max-w-sm w-full p-8 flex flex-col items-center text-center shadow-sm relative overflow-hidden bg-surface/90 border-sage">
      {/* Ambient background glow */}
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-teal-soft/60 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-accent-soft/60 blur-2xl pointer-events-none" />

      {/* Branded dual-ring animation */}
      <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
        {/* Outer glowing orbital ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-teal border-r-accent animate-spin"
          style={{ animationDuration: "1.4s" }}
        />
        {/* Inner reverse orbital ring */}
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-teal border-l-teal-deep opacity-60"
          style={{
            animation: "spinCounterClockwise 1.8s linear infinite",
          }}
        />
        {/* Central emblem */}
        <div className="w-10 h-10 rounded-full bg-teal-soft text-teal flex items-center justify-center shadow-xs">
          <GraduationCap className="w-5 h-5" />
        </div>
      </div>

      {/* Brand & Loading Labels */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="font-display text-base font-semibold text-ink tracking-tight">
            CampusPlacement
          </span>
          <span className="text-[9px] font-bold text-accent uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent-soft border border-accent/20">
            Intelligence
          </span>
        </div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </div>

      {/* Indeterminate linear sweep bar */}
      <div className="w-32 h-1 bg-sage/50 rounded-full overflow-hidden relative">
        <div className="absolute top-0 bottom-0 left-0 right-0 skeleton-shimmer rounded-full" />
      </div>
    </div>
  </div>
);

/**
 * High-fidelity Skeleton loader designed to mirror ProfilePage form structure.
 */
export const ProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
    {/* Page Header Skeleton */}
    <div className="mb-8 space-y-2">
      <div className="h-8 w-72 rounded-lg skeleton-shimmer" />
      <div className="h-4 w-96 rounded-md skeleton-shimmer" />
    </div>

    <div className="space-y-6">
      {/* Academic Details Card Skeleton */}
      <div className="panel p-6 shadow-xs space-y-5">
        <div className="h-5 w-44 rounded skeleton-shimmer border-b border-sage/60 pb-3" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-28 rounded skeleton-shimmer" />
              <div className="h-10 w-full rounded-xl border border-sage/50 skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Technical Skills Card Skeleton */}
      <div className="panel p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-sage/60 pb-3">
          <div className="space-y-1">
            <div className="h-5 w-36 rounded skeleton-shimmer" />
            <div className="h-3.5 w-64 rounded skeleton-shimmer" />
          </div>
          <div className="h-5 w-20 rounded-full skeleton-shimmer" />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 h-10 rounded-xl border border-sage/50 skeleton-shimmer" />
          <div className="w-24 h-10 rounded-xl skeleton-shimmer" />
        </div>

        <div className="p-3 bg-paper/60 rounded-xl border border-sage/60 min-h-16 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-20 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>

      {/* Submit Button Skeleton */}
      <div className="flex justify-end">
        <div className="h-11 w-36 rounded-xl skeleton-shimmer" />
      </div>
    </div>
  </div>
);

/**
 * High-fidelity Skeleton loader for StudentDashboard.
 */
export const DashboardSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
    {/* Welcome Header */}
    <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
        <div className="h-4 w-96 rounded skeleton-shimmer" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-36 rounded-xl skeleton-shimmer" />
        <div className="h-10 w-28 rounded-xl skeleton-shimmer" />
      </div>
    </div>

    {/* Metric Cards Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="panel p-5 space-y-3">
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-7 w-16 rounded skeleton-shimmer" />
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>

    {/* Big Panel Skeleton */}
    <div className="panel p-6 shadow-xs space-y-4">
      <div className="h-6 w-48 rounded skeleton-shimmer" />
      <div className="h-24 w-full rounded-xl skeleton-shimmer" />
    </div>
  </div>
);

/**
 * Reusable Card / Panel Skeleton with shimmer.
 */
export const CardSkeleton = ({ count = 2 }) => (
  <div className="space-y-4 animate-fade-up">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="panel p-6 shadow-xs space-y-3 bg-surface border-sage"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 rounded skeleton-shimmer" />
            <div className="h-3.5 w-64 rounded skeleton-shimmer" />
          </div>
          <div className="h-6 w-20 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 w-16 rounded-md skeleton-shimmer" />
          <div className="h-6 w-20 rounded-md skeleton-shimmer" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Two-column grid skeleton for Job Listings and recommendations.
 */
export const JobCardSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="panel p-5 shadow-xs space-y-3.5 bg-surface border-sage"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-40 rounded skeleton-shimmer" />
            <div className="h-3.5 w-28 rounded skeleton-shimmer" />
          </div>
          <div className="h-6 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-3.5 w-full rounded skeleton-shimmer" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-20 rounded-lg skeleton-shimmer" />
          <div className="h-6 w-24 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    ))}
  </div>
);
