import React from "react";

/** Miniature visual mockups so students can see layout differences at a glance. */

const Paper = ({ children, className = "" }) => (
  <div
    className={`relative w-full aspect-[3/4] bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const Line = ({ w = "100%", h = 3, className = "" }) => (
  <div className={`rounded-sm bg-slate-300/90 ${className}`} style={{ width: w, height: h }} />
);

const Heading = ({ w = "55%" }) => (
  <div className="rounded-sm bg-slate-800" style={{ width: w, height: 7 }} />
);

const SectionLabel = ({ w = "40%", accent = "bg-slate-700" }) => (
  <div className="space-y-1">
    <div className={`rounded-sm ${accent}`} style={{ width: w, height: 4 }} />
    <div className="h-px w-full bg-slate-300" />
  </div>
);

export const ModernAtsThumb = () => (
  <Paper>
    <div className="absolute inset-0 p-3 flex flex-col gap-1.5 bg-gradient-to-b from-slate-50 to-white">
      <Heading w="70%" />
      <Line w="58%" h={3} className="bg-teal/70" />
      <Line w="90%" h={2} />
      <div className="mt-1.5">
        <SectionLabel w="48%" accent="bg-teal" />
        <div className="mt-1.5 space-y-1">
          <Line w="100%" h={2} />
          <Line w="95%" h={2} />
          <Line w="80%" h={2} />
        </div>
      </div>
      <div className="mt-1">
        <SectionLabel w="42%" accent="bg-teal" />
        <div className="mt-1.5 space-y-1">
          <Line w="55%" h={3} className="bg-slate-500" />
          <Line w="100%" h={2} />
          <Line w="88%" h={2} />
        </div>
      </div>
      <div className="mt-1">
        <SectionLabel w="36%" accent="bg-teal" />
        <div className="mt-1.5 space-y-1">
          <Line w="62%" h={3} className="bg-slate-500" />
          <Line w="92%" h={2} />
        </div>
      </div>
      <div className="mt-auto pt-1">
        <SectionLabel w="34%" accent="bg-teal" />
        <Line w="70%" h={2} className="mt-1.5" />
      </div>
    </div>
  </Paper>
);

export const ModernMinimalistThumb = () => (
  <Paper>
    <div className="absolute inset-0 p-3 flex flex-col gap-2 bg-white">
      <div className="text-center space-y-1.5 pt-2">
        <div className="mx-auto rounded-sm bg-slate-800" style={{ width: "50%", height: 8 }} />
        <Line w="35%" h={2} className="mx-auto bg-slate-400" />
        <Line w="75%" h={2} className="mx-auto" />
      </div>
      <div className="h-px w-full bg-slate-200 my-1" />
      <SectionLabel w="28%" accent="bg-slate-500" />
      <Line w="100%" h={2} />
      <Line w="90%" h={2} />
      <div className="flex flex-wrap gap-1 mt-1">
        {["w-12", "w-14", "w-10", "w-16", "w-11"].map((w) => (
          <div key={w} className={`h-2.5 ${w} rounded-full bg-slate-200`} />
        ))}
      </div>
      <SectionLabel w="45%" accent="bg-slate-500" />
      <Line w="100%" h={2} />
      <Line w="85%" h={2} />
      <SectionLabel w="38%" accent="bg-slate-500" />
      <div className="space-y-1.5">
        <Line w="50%" h={3} className="bg-slate-500" />
        <Line w="95%" h={2} />
        <Line w="40%" h={3} className="bg-slate-500 mt-1" />
        <Line w="90%" h={2} />
      </div>
    </div>
  </Paper>
);

export const TechnicalDeveloperThumb = () => (
  <Paper>
    <div className="absolute inset-0 flex bg-white">
      <div className="w-[32%] h-full bg-slate-800 p-2 flex flex-col gap-2">
        <div className="rounded-sm bg-white/90" style={{ width: "80%", height: 6 }} />
        <div className="rounded-sm bg-teal/80" style={{ width: "60%", height: 3 }} />
        <div className="mt-2 space-y-1">
          <div className="rounded-sm bg-white/40" style={{ width: "70%", height: 3 }} />
          <div className="rounded-sm bg-white/25 w-full" style={{ height: 2 }} />
          <div className="rounded-sm bg-white/25 w-[90%]" style={{ height: 2 }} />
        </div>
        <div className="mt-2 space-y-1">
          <div className="rounded-sm bg-white/40" style={{ width: "55%", height: 3 }} />
          <div className="rounded-sm bg-teal/50 w-full" style={{ height: 4 }} />
          <div className="rounded-sm bg-teal/40 w-[85%]" style={{ height: 4 }} />
          <div className="rounded-sm bg-teal/30 w-[70%]" style={{ height: 4 }} />
        </div>
      </div>
      <div className="flex-1 p-2.5 flex flex-col gap-1.5">
        <SectionLabel w="50%" accent="bg-slate-800" />
        <Line w="100%" h={2} />
        <Line w="92%" h={2} />
        <SectionLabel w="42%" accent="bg-slate-800" />
        <Line w="55%" h={3} className="bg-slate-600" />
        <Line w="100%" h={2} />
        <Line w="88%" h={2} />
        <SectionLabel w="48%" accent="bg-slate-800" />
        <Line w="60%" h={3} className="bg-slate-600" />
        <Line w="95%" h={2} />
        <Line w="80%" h={2} />
      </div>
    </div>
  </Paper>
);

export const CorporateExperiencedThumb = () => (
  <Paper>
    <div className="absolute inset-0 p-3 flex flex-col gap-1.5 bg-white">
      <div className="border-b-2 border-slate-800 pb-2 mb-1">
        <Heading w="65%" />
        <Line w="45%" h={3} className="mt-1.5 bg-slate-500" />
        <Line w="80%" h={2} className="mt-1" />
      </div>
      <SectionLabel w="44%" accent="bg-slate-800" />
      <Line w="100%" h={2} />
      <Line w="97%" h={2} />
      <Line w="85%" h={2} />
      <div className="mt-1.5 space-y-2">
        <div>
          <Line w="70%" h={4} className="bg-slate-700" />
          <Line w="40%" h={2} className="mt-1" />
          <div className="mt-1 space-y-1 pl-1 border-l-2 border-slate-300">
            <Line w="95%" h={2} />
            <Line w="90%" h={2} />
            <Line w="88%" h={2} />
          </div>
        </div>
        <div>
          <Line w="65%" h={4} className="bg-slate-700" />
          <Line w="35%" h={2} className="mt-1" />
          <div className="mt-1 space-y-1 pl-1 border-l-2 border-slate-300">
            <Line w="92%" h={2} />
            <Line w="86%" h={2} />
          </div>
        </div>
      </div>
    </div>
  </Paper>
);

export const FresherGraduateThumb = () => (
  <Paper>
    <div className="absolute inset-0 p-3 flex flex-col gap-1.5 bg-gradient-to-br from-teal-soft/40 to-white">
      <div className="rounded-lg bg-teal/10 border border-teal/20 p-2 mb-1">
        <Heading w="60%" />
        <Line w="70%" h={3} className="mt-1.5 bg-teal/60" />
        <Line w="85%" h={2} className="mt-1" />
      </div>
      <SectionLabel w="40%" accent="bg-teal" />
      <Line w="100%" h={2} />
      <Line w="95%" h={2} />
      <Line w="78%" h={2} />
      <SectionLabel w="38%" accent="bg-teal" />
      <div className="grid grid-cols-2 gap-1">
        <Line w="100%" h={6} className="bg-teal/20" />
        <Line w="100%" h={6} className="bg-teal/15" />
        <Line w="100%" h={6} className="bg-teal/10" />
        <Line w="100%" h={6} className="bg-slate-200" />
      </div>
      <SectionLabel w="44%" accent="bg-teal" />
      <Line w="55%" h={3} className="bg-slate-600" />
      <Line w="100%" h={2} />
      <Line w="90%" h={2} />
      <div className="mt-auto">
        <SectionLabel w="32%" accent="bg-teal" />
        <Line w="75%" h={2} className="mt-1.5" />
        <Line w="50%" h={2} />
      </div>
    </div>
  </Paper>
);

const THUMB_MAP = {
  modern_ats_professional: ModernAtsThumb,
  modern_minimalist: ModernMinimalistThumb,
  technical_developer: TechnicalDeveloperThumb,
  corporate_experienced: CorporateExperiencedThumb,
  fresher_graduate: FresherGraduateThumb,
  // legacy
  ats_professional: ModernAtsThumb,
  modern_graduate: FresherGraduateThumb,
  developer_portfolio: TechnicalDeveloperThumb,
};

export const TemplateThumbnail = ({ templateId }) => {
  const Comp = THUMB_MAP[templateId] || ModernAtsThumb;
  return <Comp />;
};

export default TemplateThumbnail;
