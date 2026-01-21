import { h } from 'preact';
import { route } from 'preact-router';
import { ProjectWithMeta } from '../types';

interface ProjectCardProps {
    project: ProjectWithMeta;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const { meta } = project;
    const aiStatus = meta?.aiStatus || 'Idle';
    const risk = meta?.risk || 'Green';

    // Progress calculation helpers for "sparklines"
    const lanes = meta?.lanes || { shaping: 0, betting: 0, active: 0, shipped: 0 };
    const totalItems = (lanes.shaping + lanes.betting + lanes.active + lanes.shipped) || 1;
    const getPercent = (val: number) => Math.max(5, Math.min(100, (val / totalItems) * 100));

    const statusColor =
        risk === 'Red' ? 'text-red-500' :
            risk === 'Amber' ? 'text-amber-500' :
                'text-[#3ecf8e]';

    const glowClass =
        risk === 'Red' ? 'shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)] border-red-500/30' :
            risk === 'Amber' ? 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)] border-amber-500/30' :
                'hover:shadow-[0_0_20px_-5px_rgba(62,207,142,0.2)] hover:border-[#3ecf8e]/30';

    return (
        <div
            onClick={() => route(`/board/${project.id}`)}
            className={`
        group relative flex flex-col p-5 rounded-xl border border-border-subtle bg-[#1A1A1A] 
        cursor-pointer transition-all duration-300 ${glowClass}
      `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-[#3ecf8e] transition-colors tracking-tight">
                        {project.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor === 'text-[#3ecf8e]' ? 'bg-[#3ecf8e]' : statusColor === 'text-red-500' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                        <span className={`text-xs font-medium uppercase tracking-wider ${statusColor}`}>
                            {risk} Risk
                        </span>
                        <span className="text-border-subtle">•</span>
                        <span className="text-xs text-text-medium font-medium">
                            {meta?.primaryPhase}
                        </span>
                    </div>
                </div>

                {/* AI Status Badge */}
                <div className={`
          px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
          ${aiStatus === 'Running' ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border-[#3ecf8e]/20' :
                        aiStatus === 'Failing' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            aiStatus === 'Blocked' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                'bg-bg-surface text-text-medium border-border-subtle'}
        `}>
                    {aiStatus}
                </div>
            </div>

            {/* Metrics Grid (Sparklines) */}
            <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-medium w-16 font-medium">Shaping</span>
                    <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-text-medium/40 rounded-full"
                            style={{ width: `${getPercent(lanes.shaping)}%` }}
                        ></div>
                    </div>
                    <span className="text-xs text-text-high font-mono w-6 text-right">{lanes.shaping}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-medium w-16 font-medium">Betting</span>
                    <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-500/80 rounded-full"
                            style={{ width: `${getPercent(lanes.betting)}%` }}
                        ></div>
                    </div>
                    <span className="text-xs text-text-high font-mono w-6 text-right">{lanes.betting}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-medium w-16 font-medium">Building</span>
                    <div className="flex-1 h-1.5 bg-bg-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#3ecf8e] rounded-full shadow-[0_0_8px_rgba(62,207,142,0.4)]"
                            style={{ width: `${getPercent(lanes.active)}%` }}
                        ></div>
                    </div>
                    <span className="text-xs text-text-high font-mono w-6 text-right">{lanes.active}</span>
                </div>
            </div>

            {/* Footer: Team & Activity */}
            <div className="mt-auto pt-4 border-t border-border-subtle/50 flex items-center justify-between">
                {/* Team Avatars (Mock) */}
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full bg-border-subtle border border-[#1A1A1A] flex items-center justify-center text-[9px] text-text-high font-medium">
                            U{i}
                        </div>
                    ))}
                    <div className="w-6 h-6 rounded-full bg-bg-surface border border-[#1A1A1A] flex items-center justify-center text-[9px] text-text-medium">
                        +2
                    </div>
                </div>

                <span className="text-[11px] text-text-medium/70 truncate max-w-[120px]">
                    {meta?.lastEvent || 'No recent activity'}
                </span>
            </div>
        </div>
    );
}
