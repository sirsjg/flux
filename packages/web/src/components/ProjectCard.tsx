// import { h } removed from 'preact';
import { route } from 'preact-router';
import { ProjectWithStats } from '../stores';

interface ProjectCardProps {
    project: ProjectWithStats;
    onEdit?: (project: ProjectWithStats) => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
    const { meta } = project;
    const aiStatus = meta.aiStatus;
    const risk = meta.risk;

    // Progress calculation helpers for "sparklines"
    const lanes = meta.lanes;
    const totalItems = (lanes.shaping + lanes.betting + lanes.active + lanes.shipped) !== 0 ? (lanes.shaping + lanes.betting + lanes.active + lanes.shipped) : 1;
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
                            {meta.primaryPhase}
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

            {/* Blocker Warning */}
            {meta.blockers.count > 0 && (
                <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs text-red-400 font-medium">
                        {meta.blockers.count} blocked task{meta.blockers.count > 1 ? 's' : ''}
                        {meta.blockers.reason !== undefined && meta.blockers.reason !== "" && `: ${meta.blockers.reason}`}
                    </span>
                </div>
            )}

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

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-medium/70 truncate max-w-[120px]">
                        {meta.lastEvent !== "" ? meta.lastEvent : 'No recent activity'}
                    </span>
                    {onEdit !== undefined && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(project);
                            }}
                            className="p-2 border border-border-subtle bg-bg-surface rounded-md text-text-medium hover:text-text-high hover:border-text-medium/30 transition-colors"
                            title="Edit project settings"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
