import { useEffect, useState } from "preact/hooks";
import { route, RoutableProps } from "preact-router";
import {
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import {
  getProjects,
  resetDatabase,
  updateProject,
  type ProjectWithStats,
} from "../stores";
import { ConfirmModal, Modal, ThemeToggle } from "../components";
import { WebhooksPanel } from "../components/WebhooksPanel";

export function ProjectList(_props: RoutableProps) {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(
    null
  );
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    "configuration" | "webhooks" | "reset"
  >("configuration");
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "unknown">(
    "unknown"
  );
  const [sseStatus, setSseStatus] = useState<"online" | "offline" | "unknown">(
    "unknown"
  );
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      setSseStatus("unknown");
      setResetConfirmOpen(false);
      return;
    }
    setSseStatus("unknown");
    const eventsBase = import.meta.env.DEV ? "http://localhost:3000" : "";
    const source = new EventSource(`${eventsBase}/api/events`);
    let connected = false;
    const timeoutId = window.setTimeout(() => {
      if (!connected) setSseStatus("offline");
    }, 3000);

    const handleConnected = () => {
      connected = true;
      setSseStatus("online");
    };

    source.addEventListener("connected", handleConnected);
    source.onerror = () => {
      if (!connected) setSseStatus("offline");
    };

    return () => {
      source.removeEventListener("connected", handleConnected);
      source.close();
      window.clearTimeout(timeoutId);
    };
  }, [settingsOpen]);

  const refreshProjects = async () => {
    setLoading(true);
    setApiStatus("unknown");
    try {
      const allProjects = await getProjects();
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

  const apiOrigin =
    typeof window === "undefined" ? "" : window.location.origin;
  const apiLocation = import.meta.env.DEV
    ? "http://localhost:3000/api"
    : `${apiOrigin}/api`;
  const sseLocation = import.meta.env.DEV
    ? "http://localhost:3000/api/events"
    : `${apiOrigin}/api/events`;

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

  const settingsSections = [
    {
      id: "configuration",
      title: "Configuration",
      subtitle: "API endpoints and realtime status",
    },
    {
      id: "webhooks",
      title: "Webhooks",
      subtitle: "Outbound events and delivery history",
    },
    {
      id: "reset",
      title: "Reset",
      subtitle: "Wipe data and start fresh",
    },
  ] as const;

  if (loading) {
    return (
      <div class="min-h-screen bg-base-200 flex items-center justify-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-base-200">
      <div class="navbar bg-base-100 shadow-lg">
        <div class="flex-1">
          <span class="text-xl font-bold px-4">Flux</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <button
            class="btn btn-ghost btn-sm btn-circle"
            onClick={openSettings}
            title="Settings"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow border-2 border-dashed border-base-300 text-left"
            onClick={() => route("/new")}
          >
            <div class="card-body items-center justify-center text-center">
              <div class="text-4xl font-semibold">+</div>
              <div class="text-lg font-semibold">New Project</div>
            </div>
          </button>

          {projects.map((project) => (
            <div
              key={project.id}
              class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => route(`/board/${project.id}`)}
            >
              <div class="card-body">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="card-title">{project.name}</h3>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-circle"
                    aria-label="Edit project"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(project);
                    }}
                  >
                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {project.description && (
                  <p class="text-base-content/60 text-sm line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div class="mt-2">
                  {project.stats.total === 0 ? (
                    <span class="badge badge-soft badge-sm">No tasks</span>
                  ) : (
                    <span
                      class={`badge badge-soft badge-sm ${
                        project.stats.done === project.stats.total
                          ? "badge-success"
                          : ""
                      }`}
                    >
                      {project.stats.done} of {project.stats.total} complete
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        boxClassName="!w-[80vw] !h-[80vh] !max-w-none !max-h-none overflow-y-auto"
      >
        <div class="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div class="bg-base-200 rounded-box p-0">
            <ul class="menu">
              {settingsSections.map((section) => {
                const isActive = settingsSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      class={`rounded-none flex flex-col items-start gap-0.5 ${
                        isActive
                          ? "bg-base-300 border-l-4 border-primary"
                          : ""
                      }`}
                      onClick={() => setSettingsSection(section.id)}
                    >
                      <span class="font-medium">{section.title}</span>
                      <span class="text-xs text-base-content/60">
                        {section.subtitle}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div class="bg-base-100 rounded-box border border-base-200 p-4 min-h-[360px]">
            {settingsSection === "configuration" && (
              <div class="space-y-4">
                <div>
                  <h4 class="text-lg font-semibold">Configuration</h4>
                  <p class="text-sm text-base-content/60">
                    Read-only diagnostics for your Flux instance.
                  </p>
                </div>
                <div class="space-y-3">
                  <div class="rounded-lg border border-base-200 p-3">
                    <div class="text-xs uppercase tracking-wide text-base-content/60">
                      API Location
                    </div>
                    <div class="mt-1 font-mono text-xs">{apiLocation}</div>
                  </div>
                  <div class="rounded-lg border border-base-200 p-3">
                    <div class="text-xs uppercase tracking-wide text-base-content/60">
                      Events Stream
                    </div>
                    <div class="mt-1 font-mono text-xs">{sseLocation}</div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="flex items-center gap-3 rounded-lg border border-base-200 p-3">
                    <span
                      class={`h-2.5 w-2.5 rounded-full ${statusDotClass(
                        apiStatus
                      )}`}
                    ></span>
                    <div>
                      <div class="text-sm font-medium">API Status</div>
                      <div class="text-xs text-base-content/60">
                        {statusLabel(apiStatus)}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 rounded-lg border border-base-200 p-3">
                    <span
                      class={`h-2.5 w-2.5 rounded-full ${statusDotClass(
                        sseStatus
                      )}`}
                    ></span>
                    <div>
                      <div class="text-sm font-medium">SSE Updates</div>
                      <div class="text-xs text-base-content/60">
                        {statusLabel(sseStatus)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsSection === "webhooks" && (
              <div class="space-y-4">
                <WebhooksPanel />
              </div>
            )}

            {settingsSection === "reset" && (
              <div class="space-y-4">
                <div>
                  <h4 class="text-lg font-semibold">Reset Database</h4>
                  <p class="text-sm text-base-content/60">
                    This will wipe all projects, tasks, epics, and webhooks.
                  </p>
                </div>
                <div class="alert alert-warning">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  <span>
                    This action is permanent. You cannot undo a reset.
                  </span>
                </div>
                <button
                  type="button"
                  class="btn btn-error"
                  onClick={() => setResetConfirmOpen(true)}
                  disabled={resetting}
                >
                  {resetting ? (
                    <span class="loading loading-spinner loading-sm"></span>
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
          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Project Name *</span>
            </label>
            <input
              type="text"
              class="input input-bordered w-full"
              value={editName}
              onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
              required
            />
          </div>

          <div class="form-control mb-6">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={3}
              value={editDescription}
              onInput={(e) =>
                setEditDescription((e.target as HTMLTextAreaElement).value)
              }
            />
          </div>

          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost"
              onClick={() => closeEditModal()}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={!editName.trim() || saving}
            >
              {saving ? (
                <span class="loading loading-spinner loading-sm"></span>
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
    </div>
  );
}
