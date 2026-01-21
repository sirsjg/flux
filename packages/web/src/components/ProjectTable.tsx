
import { ProjectWithStats } from '../stores';

interface ProjectTableProps {
    projects: ProjectWithStats[];
    onProjectClick: (project: ProjectWithStats) => void;
}

export function ProjectTable({ projects, onProjectClick }: ProjectTableProps) {
    const aiStatusColors = {
        Idle: 'text-text-medium',
        Running: 'text-brand-primary',
        Blocked: 'text-orange-400',
        Failing: 'text-red-500',
    };

    const riskColors = {
        Green: 'text-brand-primary',
        Amber: 'text-orange-400',
        Red: 'text-red-500',
    };

    return (
        <div className="w-full overflow-hidden rounded-lg border border-border-default bg-bg-surface">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-border-default bg-bg-surface-hover text-text-medium">
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">AI</th>
                        <th className="px-4 py-3 font-medium">Risk</th>
                        <th className="px-4 py-3 font-medium text-center">Sh</th>
                        <th className="px-4 py-3 font-medium text-center">Bt</th>
                        <th className="px-4 py-3 font-medium text-center">Ac</th>
                        <th className="px-4 py-3 font-medium text-center">Sp</th>
                        <th className="px-4 py-3 font-medium">Thrash (cuts/retries)</th>
                        <th className="px-4 py-3 font-medium">Last event</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                    {projects.map((project) => (
                        <tr
                            key={project.id}
                            className="group cursor-pointer hover:bg-bg-surface-hover transition-colors"
                            onClick={() => onProjectClick(project)}
                        >
                            <td className="px-4 py-3 font-medium text-text-high group-hover:text-brand-primary">
                                {project.name}
                            </td>
                            <td className={`px-4 py-3 font-medium ${aiStatusColors[project.meta.aiStatus]}`}>
                                {project.meta.aiStatus}
                            </td>
                            <td className={`px-4 py-3 font-medium ${riskColors[project.meta.risk]}`}>
                                {project.meta.risk}
                            </td>
                            <td className="px-4 py-3 text-center text-text-medium">{project.meta.lanes.shaping}</td>
                            <td className="px-4 py-3 text-center text-text-medium">{project.meta.lanes.betting}</td>
                            <td className="px-4 py-3 text-center text-text-medium">{project.meta.lanes.active}</td>
                            <td className="px-4 py-3 text-center text-text-medium">{project.meta.lanes.shipped}</td>
                            <td className="px-4 py-3 text-text-medium font-mono">
                                {project.meta.thrash.cuts} / {project.meta.thrash.retries}
                            </td>
                            <td className="px-4 py-3 text-text-medium truncate max-w-[150px]" title={project.meta.lastEvent}>
                                {project.meta.lastEvent}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
