import { useEffect, useState, useMemo } from "preact/hooks";
import { route, RoutableProps } from "preact-router";
import {
    ExclamationTriangleIcon,
    Squares2X2Icon,
    TableCellsIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowsUpDownIcon
} from "@heroicons/react/24/outline";
import {
    getProjects,
    resetDatabase,
    updateProject,
    type ProjectWithStats,
} from "../stores";
import {
    ConfirmModal,
    Modal,
    AppLayout,
    ProjectCard,
    ProjectTable,
    WebhooksPanel,
} from "../components";

export function ProjectList(_props: RoutableProps) {
    const [projects, setProjects] = useState<ProjectWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    // Existing state
    const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState<"configuration" | "webhooks" | "reset">("configuration");
    const [apiStatus, setApiStatus] = useState<"online" | "offline" | "unknown">("unknown");
    const [sseStatus, setSseStatus] = useState<"online" | "offline" | "unknown">("unknown");
    const [resetting, setResetting] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

    useEffect(() => {
        refreshProjects();
    }, []);

    const refreshProjects = async () => {
        setLoading(true);
        setApiStatus("unknown");
        try {
            const allProjects = await getProjects();
            // Projects now include meta field from API
            setProjects(allProjects);
            setApiStatus("online");
        } catch {
            setProjects([]);
            setApiStatus("offline");
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (project: ProjectWithStats) => {
        setEditingProject(project);
        setEditName(project.name);
        setEditDescription(project.description || "");
    };

    const closeEditModal = (force = false) => {
        if (saving && !force) return;
        setEditingProject(null);
        setEditName("");
        setEditDescription("");
    };

    const openSettings = () => {
        setSettingsSection("configuration");
        setSettingsOpen(true);
    };

    const handleReset = async () => {
        if (resetting) return;
        setResetting(true);
        try {
            await resetDatabase();
            await refreshProjects();
        } finally {
            setResetting(false);
            setResetConfirmOpen(false);
        }
    };

    const handleEditSubmit = async (e: Event) => {
        e.preventDefault();
        if (!editingProject || !editName.trim() || saving) return;

        setSaving(true);
        let didSave = false;
        try {
            await updateProject(editingProject.id, {
                name: editName.trim(),
                description: editDescription.trim() || undefined,
            });
            await refreshProjects();
            didSave = true;
        } finally {
            setSaving(false);
            if (didSave) {
                closeEditModal(true);
            }
        }
    };

    // Filter projects
    const filteredProjects = useMemo(() => {
        if (!searchQuery) return projects;
        const lowerQuery = searchQuery.toLowerCase();
        return projects.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description?.toLowerCase().includes(lowerQuery)
        );
    }, [projects, searchQuery]);

    // Status helpers from existing code
    const apiOrigin = typeof window === "undefined" ? "" : window.location.origin;
    const apiLocation = import.meta.env.DEV ? "http://localhost:3000/api" : `${apiOrigin}/api`;
    const sseLocation = import.meta.env.DEV ? "http://localhost:3000/api/events" : `${apiOrigin}/api/events`;
    const statusLabel = (status: "online" | "offline" | "unknown") => {
        if (status === "online") return "Online";
        if (status === "offline") return "Offline";
        return "Checking";
    };
    const statusDotClass = (status: "online" | "offline" | "unknown") => {
        if (status === "online") return "bg-success";
        if (status === "offline") return "bg-error";
        return "bg-base-content/30";
    };

    // Settings Menu Config
    const settingsSections = [
        { id: "configuration", title: "Configuration", subtitle: "API endpoints and realtime status" },
        { id: "webhooks", title: "Webhooks", subtitle: "Outbound events and delivery history" },
        { id: "reset", title: "Reset", subtitle: "Wipe data and start fresh" },
    ] as const;

    if (loading) {
        return (
            <AppLayout currentPath="/" breadcrumbs={[{ label: 'Projects', active: true }]}>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </AppLayout>
        );
    }

    return (
        <>
            <AppLayout
                currentPath="/"
                breadcrumbs={[{ label: 'Projects', active: true }]}
                userInitials="U"
                onFeedbackClick={openSettings}
            >
                <div className="p-8 max-w-[1600px] mx-auto text-text-high">

                    {/* Dashboard Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold mb-6 text-text-high">PROJECTS</h1>

                        <div className="flex flex-col gap-4 bg-bg-surface p-4 rounded-lg border border-border-default shadow-sm">
                            {/* Controls Row */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="relative flex-1 min-w-[240px]">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-low" />
                                    <input
                                        type="text"
                                        placeholder="Search projects..."
                                        className="w-full bg-bg-base border border-border-default rounded-md py-2 pl-9 pr-4 text-sm focus:border-brand-primary transition-colors text-text-high"
                                        value={searchQuery}
                                        onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-text-medium">Filter:</span>
                                    <button className="flex items-center gap-2 px-3 py-2 bg-bg-base border border-border-default rounded-md text-sm hover:border-text-medium transition-colors text-text-high">
                                        <FunnelIcon className="w-4 h-4" />
                                        All
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-text-medium">Sort:</span>
                                    <button className="flex items-center gap-2 px-3 py-2 bg-bg-base border border-border-default rounded-md text-sm hover:border-text-medium transition-colors text-text-high">
                                        <ArrowsUpDownIcon className="w-4 h-4" />
                                        Risk
                                    </button>
                                </div>

                                <div className="h-6 w-px bg-border-subtle mx-2" />

                                <div className="flex gap-1 bg-bg-base p-1 rounded-md border border-border-subtle">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-bg-surface shadow text-text-high' : 'text-text-low hover:text-text-medium'}`}
                                    >
                                        <Squares2X2Icon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-bg-surface shadow text-text-high' : 'text-text-low hover:text-text-medium'}`}
                                    >
                                        <TableCellsIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Legend Row */}
                            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-text-medium pt-2 border-t border-border-subtle">
                                <div className="flex gap-2">
                                    <span className="font-semibold text-text-low">Legend:</span>
                                    <span>AI = Idle/Run/Blk/Fail</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-semibold text-text-low">Risk =</span>
                                    <span className="text-brand-primary">G</span>/<span className="text-orange-400">A</span>/<span className="text-red-500">R</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-semibold text-text-low">Thrash =</span>
                                    <span>scope cuts + retries</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Project Content */}
                    {filteredProjects.length === 0 ? (
                        <div className="text-center py-20 text-text-medium bg-bg-surface-hover/30 rounded-lg border border-dashed border-border-default">
                            <p>No projects found matching your search.</p>
                            {projects.length === 0 && (
                                <button className="btn btn-primary mt-4" onClick={() => route('/new')}>Create your first project</button>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                            {/* New Project Card */}
                            <button
                                type="button"
                                className="flex flex-col items-center justify-center gap-4 bg-bg-surface/50 border-2 border-dashed border-border-subtle rounded-lg p-6 hover:bg-bg-surface hover:border-brand-primary/50 transition-all cursor-pointer min-h-[300px] group"
                                onClick={() => route("/new")}
                            >
                                <div className="w-16 h-16 rounded-full bg-bg-base flex items-center justify-center group-hover:bg-brand-primary/10 transition-colors">
                                    <span className="text-3xl text-text-medium group-hover:text-brand-primary">+</span>
                                </div>
                                <div className="text-lg font-semibold text-text-medium group-hover:text-text-high">New Project</div>
                            </button>

                            {filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onClick={() => route(`/board/${project.id}`)}
                                />
                            ))}
                        </div>
                    ) : (
                        <ProjectTable
                            projects={filteredProjects}
                            onProjectClick={(p) => route(`/board/${p.id}`)}
                        />
                    )}

                </div>
            </AppLayout>

            {/* Settings Modal (kept same as before) */}
            <Modal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                title="Settings"
                boxClassName="!w-[80vw] !h-[80vh] !max-w-none !max-h-none overflow-y-auto"
            >
                <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                    <div className="bg-base-200 rounded-box p-0">
                        <ul className="menu">
                            {settingsSections.map((section) => {
                                const isActive = settingsSection === section.id;
                                return (
                                    <li key={section.id}>
                                        <button
                                            type="button"
                                            className={`rounded-none flex flex-col items-start gap-0.5 ${isActive
                                                ? "bg-base-300 border-l-4 border-primary"
                                                : ""
                                                }`}
                                            onClick={() => setSettingsSection(section.id)}
                                        >
                                            <span className="font-medium">{section.title}</span>
                                            <span className="text-xs text-base-content/60">
                                                {section.subtitle}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="bg-base-100 rounded-box border border-base-200 p-4 min-h-[360px]">
                        {settingsSection === "configuration" && (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-lg font-semibold">Configuration</h4>
                                    <p className="text-sm text-base-content/60">
                                        Read-only diagnostics for your Flux instance.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-base-200 p-3">
                                        <div className="text-xs uppercase tracking-wide text-base-content/60">
                                            API Location
                                        </div>
                                        <div className="mt-1 font-mono text-xs">{apiLocation}</div>
                                    </div>
                                    <div className="rounded-lg border border-base-200 p-3">
                                        <div className="text-xs uppercase tracking-wide text-base-content/60">
                                            Events Stream
                                        </div>
                                        <div className="mt-1 font-mono text-xs">{sseLocation}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 rounded-lg border border-base-200 p-3">
                                        <span
                                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass(
                                                apiStatus
                                            )}`}
                                        ></span>
                                        <div>
                                            <div className="text-sm font-medium">API Status</div>
                                            <div className="text-xs text-base-content/60">
                                                {statusLabel(apiStatus)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-lg border border-base-200 p-3">
                                        <span
                                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass(
                                                sseStatus
                                            )}`}
                                        ></span>
                                        <div>
                                            <div className="text-sm font-medium">SSE Updates</div>
                                            <div className="text-xs text-base-content/60">
                                                {statusLabel(sseStatus)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settingsSection === "webhooks" && (
                            <div className="space-y-4">
                                <WebhooksPanel />
                            </div>
                        )}

                        {settingsSection === "reset" && (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-lg font-semibold">Reset Database</h4>
                                    <p className="text-sm text-base-content/60">
                                        This will wipe all projects, tasks, epics, and webhooks.
                                    </p>
                                </div>
                                <div className="alert alert-warning">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                    <span>
                                        This action is permanent. You cannot undo a reset.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-error"
                                    onClick={() => setResetConfirmOpen(true)}
                                    disabled={resetting}
                                >
                                    {resetting ? (
                                        <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                        "Reset Database"
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!editingProject}
                onClose={closeEditModal}
                title="Edit Project"
            >
                <form onSubmit={handleEditSubmit}>
                    <div className="form-control mb-4">
                        <label className="label">
                            <span className="label-text">Project Name *</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            value={editName}
                            onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                            required
                        />
                    </div>

                    <div className="form-control mb-6">
                        <label class="label">
                            <span className="label-text">Description</span>
                        </label>
                        <textarea
                            className="textarea textarea-bordered w-full"
                            rows={3}
                            value={editDescription}
                            onInput={(e) =>
                                setEditDescription((e.target as HTMLTextAreaElement).value)
                            }
                        />
                    </div>

                    <div className="modal-action">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => closeEditModal()}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!editName.trim() || saving}
                        >
                            {saving ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                "Save"
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={resetConfirmOpen}
                title="Reset Database?"
                description="This will wipe all projects, tasks, epics, and webhooks. This action cannot be undone."
                confirmLabel="Reset"
                confirmClassName="btn-error"
                onConfirm={handleReset}
                onClose={() => {
                    if (!resetting) setResetConfirmOpen(false);
                }}
                isLoading={resetting}
            />
        </>
    );
}
