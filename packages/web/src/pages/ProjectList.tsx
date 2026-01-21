import type { JSX } from "preact";
import { useEffect, useState, useMemo } from "preact/hooks";
import { route, type RoutableProps } from "preact-router";
import {
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  getProjects,
  resetDatabase,
  updateProject,
  ProjectWithStats,
} from "../stores";
import {
  ConfirmModal,
  Modal,
  AppLayout,
  WebhooksPanel,
  StandardPageHeader,
  StandardSearchBar,
  StandardViewToggle,
  StandardButton,
  ProjectCard,
  SidePanel,
} from "../components";
import { AIStatus, RiskLevel, ProjectPhase } from "../types";

// Mock generator removed - using real data from API

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProjectList(_props?: RoutableProps): JSX.Element {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Existing state
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhase, setEditPhase] = useState<ProjectPhase>("Shaping");
  const [editRisk, setEditRisk] = useState<RiskLevel>("Green");
  const [editAiStatus, setEditAiStatus] = useState<AIStatus>("Idle");
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"configuration" | "webhooks" | "reset">("configuration");
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "unknown">("unknown");
  const [sseStatus] = useState<"online" | "offline" | "unknown">("unknown");
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    void refreshProjects();
  }, []);

  const refreshProjects = async (): Promise<void> => {
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

  const closeEditModal = (force = false): void => {
    if (saving && !force) return;
    setEditingProject(null);
    setEditName("");
    setEditDescription("");
    setEditPhase("Shaping");
    setEditRisk("Green");
    setEditAiStatus("Idle");
  };

  const openSettings = (): void => {
    setSettingsSection("configuration");
    setSettingsOpen(true);
  };

  const handleReset = async (): Promise<void> => {
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

  const handleEditSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (editingProject === null || editName.trim() === "" || saving) return;

    setSaving(true);
    let didSave = false;
    try {
      await updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim() !== "" ? editDescription.trim() : undefined,
        ai_status: editAiStatus,
        risk_level: editRisk,
        primary_phase: editPhase,
      });

      // Refresh projects to get updated data from server
      await refreshProjects();

      didSave = true;
    } finally {
      setSaving(false);
      if (didSave) {
        closeEditModal(true);
      }
    }
  };

  const openEditModal = (project: ProjectWithStats): void => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditPhase(project.meta.primaryPhase);
    setEditRisk(project.meta.risk);
    setEditAiStatus(project.meta.aiStatus);
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (searchQuery === "") return projects;
    const lowerQuery = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.description?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }, [projects, searchQuery]);

  // Status helpers from existing code
  const apiOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const apiLocation = import.meta.env.DEV ? "http://localhost:3000/api" : `${apiOrigin}/api`;
  const sseLocation = import.meta.env.DEV ? "http://localhost:3000/api/events" : `${apiOrigin}/api/events`;
  const statusLabel = (status: "online" | "offline" | "unknown"): string => {
    if (status === "online") return "Online";
    if (status === "offline") return "Offline";
    return "Checking";
  };
  const statusDotClass = (status: "online" | "offline" | "unknown"): string => {
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
        <div className="p-6">

          {/* Page Header with Description */}
          <StandardPageHeader
            title="Projects"
            subtitle="Organize work into self-contained projects."
            toolbar={
              <>
                <StandardSearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search projects..."
                />
                <StandardViewToggle<'grid' | 'table'>
                  value={viewMode}
                  onChange={(mode) => setViewMode(mode)}
                  options={[
                    {
                      value: 'grid',
                      icon: (
                        <svg width='16' height='16' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
                          <rect x='3' y='3' width='7' height='7'></rect>
                          <rect x='14' y='3' width='7' height='7'></rect>
                          <rect x='14' y='14' width='7' height='7'></rect>
                          <rect x='3' y='14' width='7' height='7'></rect>
                        </svg>
                      )
                    },
                    {
                      value: 'table',
                      icon: (
                        <svg width='16' height='16' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
                          <path d="M3 12h18M3 6h18M3 18h18"></path>
                        </svg>
                      )
                    }
                  ]}
                />
                <StandardButton icon={
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M3 12h18M3 18h18"></path>
                  </svg>
                }>
                  Filter
                </StandardButton>
                <StandardButton onClick={() => void refreshProjects()} icon={
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                }>
                  Sync <span className="opacity-50 text-[11px] ml-1 font-normal">Just now</span>
                </StandardButton>

                <div className="w-px h-4 bg-border-subtle mx-1" />

                <StandardButton
                  variant="primary"
                  onClick={() => route('/new')}
                  icon={
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  }
                >
                  New Project
                </StandardButton>
              </>
            }
          />



          {/* Project Content Section */}
          <section className="mt-6">
            {/* Section Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-high tracking-tight">
                  All Projects
                </h2>
                <p className="text-xs text-text-medium mt-1">
                  {filteredProjects.length} projects sorted by workflow phase
                </p>
              </div>
            </div>

            {/* List Header removed - Dashboard Grid */}

            {filteredProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No projects found</div>
                <div className="empty-state-description">
                  {projects.length === 0
                    ? 'Get started by creating your first project'
                    : 'Try adjusting your search or filters'}
                </div>
                {projects.length === 0 && (
                  <button className="btn mt-4" onClick={() => route('/new')}>Create First Project</button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-6 pb-20" style={{ gridTemplateColumns: 'repeat(auto-fill, 340px)' }}>
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} onEdit={openEditModal} />
                ))}

                {/* Add New Project Card */}
                <button
                  onClick={() => route('/new')}
                  className="group relative flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-border-subtle bg-[#1A1A1A]/50 hover:bg-[#1A1A1A] hover:border-[#3ecf8e]/50 cursor-pointer transition-all duration-300 min-h-[300px]"
                >
                  <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm border border-border-subtle">
                    <span className="text-2xl text-text-medium group-hover:text-[#3ecf8e] transition-colors">+</span>
                  </div>
                  <h3 className="text-base font-semibold text-text-high group-hover:text-[#3ecf8e] transition-colors">Create New Project</h3>
                  <p className="text-xs text-text-medium mt-1">Start a new cycle stream</p>
                </button>
              </div>
            ) : (
              // Compact Table View
              <div className="flex flex-col pb-20">
                <div className="border border-white/10 rounded-lg overflow-hidden bg-[#1A1A1A]">
                  {/* Table Header */}
                  <div className="grid grid-cols-[minmax(200px,2fr)_120px_100px_100px_1fr_48px] gap-4 px-6 py-3 border-b border-white/10 bg-[#1A1A1A] text-xs font-mono font-medium text-text-medium uppercase tracking-wider">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-text-high">
                      PROJECT
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                        <path d="M7 11l5-5 5 5M7 13l5 5 5-5" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-text-high">
                      PHASE
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-0 hover:opacity-50 group-hover:opacity-50">
                        <path d="M7 11l5-5 5 5M7 13l5 5 5-5" />
                      </svg>
                    </div>
                    <div className="cursor-pointer hover:text-text-high">RISK</div>
                    <div className="cursor-pointer hover:text-text-high">AI STATUS</div>
                    <div className="text-right cursor-pointer hover:text-text-high flex items-center justify-end gap-2">
                      LAST ACTIVITY
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                        <path d="M7 13l5 5 5-5" />
                      </svg>
                    </div>
                    <div></div>
                  </div>

                  <div className="bg-bg-surface">
                    {filteredProjects.map((project, index) => {
                      const { meta } = project;
                      const aiStatus = meta.aiStatus;
                      const risk = meta.risk;

                      const statusColor =
                        risk === 'Red' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                          risk === 'Amber' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                            'text-[#3ecf8e] bg-[#3ecf8e]/10 border-[#3ecf8e]/20';

                      return (
                        <div
                          key={project.id}
                          onClick={() => route(`/board/${project.id}`)}
                          className={`grid grid-cols-[minmax(200px,2fr)_120px_100px_100px_1fr_48px] gap-4 px-6 py-4 hover:bg-bg-surface-hover cursor-pointer transition-colors items-center group border-l-2 border-transparent hover:border-primary ${index !== filteredProjects.length - 1 ? 'border-b border-white/5' : ''
                            }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-text-high group-hover:text-primary transition-colors truncate">
                              {project.name}
                            </span>
                            {project.description !== undefined && project.description !== "" && (
                              <span className="text-xs text-text-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {project.description}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-text-medium font-medium">
                            {meta.primaryPhase}
                          </div>

                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full bg-current`}></span>
                              {risk}
                            </span>
                          </div>

                          <div>
                            <span className={`
                            text-[11px] font-mono px-1.5 py-0.5 rounded border
                            ${aiStatus === 'Running' ? 'text-primary border-primary/20 bg-primary/5' :
                                aiStatus === 'Failing' ? 'text-red-500 border-red-500/20 bg-red-500/5' :
                                  aiStatus === 'Blocked' ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' :
                                    'text-text-low border-border-subtle bg-bg-surface'}
                          `}>
                              {aiStatus}
                            </span>
                          </div>

                          <div className="text-right text-xs text-text-medium font-mono">
                            {meta.lastEvent}
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(project);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-white/5 bg-white/5 hover:bg-white/10 text-text-medium transition-all"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 12h.01M12 6h.01M12 18h.01" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredProjects.length === 0 && (
                      <div className="p-8 text-center text-text-medium text-sm">
                        No projects found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


          </section>
        </div>
      </AppLayout>

      {/* Settings Modal */}
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

      <SidePanel
        isOpen={editingProject !== null}
        onClose={closeEditModal}
        title="Edit Project"
      >
        <form onSubmit={(e) => void handleEditSubmit(e)}>
            <div className="space-y-6">
              <div className="form-control">
                <label className="label px-0 pt-0 mb-2">
                  <span className="text-sm font-medium text-gray-400">Project Name *</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-[#3ECF8E] focus:outline-none transition-colors"
                  value={editName}
                  onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                  required
                  placeholder="Enter project name..."
                />
              </div>

              <div className="form-control">
                <label className="label px-0 pt-0 mb-2">
                  <span className="text-sm font-medium text-gray-400">Description</span>
                </label>
                <textarea
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-[#3ECF8E] focus:outline-none transition-colors min-h-[100px] resize-y"
                  rows={4}
                  value={editDescription}
                  onInput={(e) =>
                    setEditDescription((e.target as HTMLTextAreaElement).value)
                  }
                  placeholder="Optional description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label px-0 pt-0 mb-2">
                    <span className="text-sm font-medium text-gray-400">Phase</span>
                  </label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2.5 text-sm text-white focus:border-[#3ECF8E] focus:outline-none transition-colors appearance-none"
                    value={editPhase}
                    onChange={(e) => setEditPhase((e.target as HTMLSelectElement).value as ProjectPhase)}
                  >
                    <option value="Shaping">Shaping</option>
                    <option value="Betting">Betting</option>
                    <option value="Active">Active</option>
                    <option value="Shipped">Shipped</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label px-0 pt-0 mb-2">
                    <span className="text-sm font-medium text-gray-400">Risk</span>
                  </label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2.5 text-sm text-white focus:border-[#3ECF8E] focus:outline-none transition-colors appearance-none"
                    value={editRisk}
                    onChange={(e) => setEditRisk((e.target as HTMLSelectElement).value as RiskLevel)}
                  >
                    <option value="Green">Green</option>
                    <option value="Amber">Amber</option>
                    <option value="Red">Red</option>
                  </select>
                </div>

                <div className="form-control col-span-2">
                  <label className="label px-0 pt-0 mb-2">
                    <span className="text-sm font-medium text-gray-400">AI Status</span>
                  </label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#333] rounded-md px-3 py-2.5 text-sm text-white focus:border-[#3ECF8E] focus:outline-none transition-colors appearance-none"
                    value={editAiStatus}
                    onChange={(e) => setEditAiStatus((e.target as HTMLSelectElement).value as AIStatus)}
                  >
                    <option value="Idle">Idle</option>
                    <option value="Running">Running</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Failing">Failing</option>
                  </select>
                </div>
              </div>
            </div>

          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border-subtle">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-text-medium hover:text-text-high transition-colors"
              onClick={() => closeEditModal()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-[#3ECF8E] hover:bg-[#34b078] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={editName.trim() === '' || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </SidePanel>

      <ConfirmModal
        isOpen={resetConfirmOpen}
        title="Reset Database?"
        description="This will wipe all projects, tasks, epics, and webhooks. This action cannot be undone."
        confirmLabel="Reset"
        confirmClassName="btn-error"
        onConfirm={() => void handleReset()}
        onClose={() => {
          if (!resetting) setResetConfirmOpen(false);
        }}
        isLoading={resetting}
      />
    </>
  );
}
