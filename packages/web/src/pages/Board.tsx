import { useEffect, useState } from "preact/hooks";
import { route, RoutableProps } from "preact-router";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  getProject,
  getTasks,
  getEpics,
  updateTask,
  cleanupProject,
  type TaskWithBlocked,
} from "../stores";
import type { Epic } from "@flux/shared";
import { STATUSES, STATUS_CONFIG, EPIC_COLORS } from "@flux/shared";
import {
  TaskForm,
  EpicForm,
  DraggableTaskCard,
  DroppableColumn,
  ThemeToggle,
} from "../components";

interface BoardProps extends RoutableProps {
  projectId?: string;
}

// Get color for epic based on index
const getEpicColor = (epicId: string, epics: Epic[]): string => {
  const index = epics.findIndex((e) => e.id === epicId);
  return EPIC_COLORS[index % EPIC_COLORS.length];
};

export function Board({ projectId }: BoardProps) {
  const [tasks, setTasks] = useState<TaskWithBlocked[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  // Collapsed state for epic swimlanes
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());

  // Modal state
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [epicFormOpen, setEpicFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithBlocked | undefined>(
    undefined
  );
  const [editingEpic, setEditingEpic] = useState<Epic | undefined>(undefined);
  const [defaultEpicId, setDefaultEpicId] = useState<string | undefined>(undefined);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEpicId, setFilterEpicId] = useState<string | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string | "all">("all");

  // Cleanup dialog state
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupArchiveTasks, setCleanupArchiveTasks] = useState(true);
  const [cleanupArchiveEpics, setCleanupArchiveEpics] = useState(true);

  // View mode state
  const [viewMode, setViewMode] = useState<"normal" | "condensed">("normal");

  // Planning column collapsed state
  const [planningCollapsed, setPlanningCollapsed] = useState(false);

  // Configure sensors with activation constraint to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (!projectId) {
      route("/");
      return;
    }
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const eventsBase = import.meta.env.DEV ? "http://localhost:3000" : "";
    let source: EventSource | null = null;
    let refreshTimeout: number | null = null;
    let reconnectTimeout: number | null = null;
    let isMounted = true;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }
      refreshTimeout = window.setTimeout(() => {
        refreshData();
      }, 100);
    };

    const connect = () => {
      if (!isMounted) return;

      source = new EventSource(`${eventsBase}/api/events`);

      source.addEventListener("data-changed", scheduleRefresh);

      source.addEventListener("connected", () => {
        // Refresh data on reconnect to catch any missed updates
        scheduleRefresh();
      });

      source.onerror = () => {
        source?.close();
        // Reconnect after 2 seconds
        if (isMounted) {
          reconnectTimeout = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
      source?.close();
    };
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;
    setLoading(true);
    const project = await getProject(projectId);
    if (!project) {
      route("/");
      return;
    }
    setProjectName(project.name);
    await refreshData();
    setLoading(false);
  };

  const refreshData = async () => {
    if (!projectId) return;
    const [tasksData, epicsData] = await Promise.all([
      getTasks(projectId),
      getEpics(projectId),
    ]);
    setTasks(tasksData);
    setEpics(epicsData);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const dropZoneId = over.id as string;
    const [newStatus, epicPart] = dropZoneId.split(":");
    const newEpicId = epicPart === "unassigned" ? undefined : epicPart;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status !== newStatus || task.epic_id !== newEpicId) {
      await updateTask(taskId, {
        status: newStatus,
        epic_id: newEpicId,
      });
      await refreshData();
    }
  };

  // Toggle epic collapse
  const toggleEpicCollapse = (epicId: string) => {
    setCollapsedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  // Task form handlers
  const openNewTask = (epicId?: string) => {
    setEditingTask(undefined);
    setDefaultEpicId(epicId);
    setTaskFormOpen(true);
  };

  const openEditTask = (task: TaskWithBlocked) => {
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const closeTaskForm = () => {
    setTaskFormOpen(false);
    setEditingTask(undefined);
    setDefaultEpicId(undefined);
  };

  // Epic form handlers
  const openNewEpic = () => {
    setEditingEpic(undefined);
    setEpicFormOpen(true);
  };

  const openEditEpic = (epic: Epic) => {
    setEditingEpic(epic);
    setEpicFormOpen(true);
  };

  const closeEpicForm = () => {
    setEpicFormOpen(false);
    setEditingEpic(undefined);
  };

  // Cleanup handlers
  const handleCleanup = async () => {
    if (!projectId) return;
    await cleanupProject(projectId, cleanupArchiveTasks, cleanupArchiveEpics);
    setCleanupDialogOpen(false);
    setCleanupArchiveTasks(true);
    setCleanupArchiveEpics(true);
    await refreshData();
  };

  // Get count of done tasks (for archive button)
  const doneTaskCount = tasks.filter((t) => t.status === "done").length;

  // Filter tasks
  const filterTask = (task: TaskWithBlocked): boolean => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesNotes = task.notes.toLowerCase().includes(query);
      if (!matchesTitle && !matchesNotes) return false;
    }
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    return true;
  };

  // Get tasks for a specific column and epic
  const getColumnTasks = (status: string, epicId: string | undefined) =>
    tasks
      .filter((t) => t.epic_id === epicId && t.status === status)
      .filter(filterTask);

  // Get task count for an epic
  const getEpicTaskCount = (epicId: string | undefined) =>
    tasks.filter((t) => t.epic_id === epicId).filter(filterTask).length;

  // Generate drop zone ID
  const getDropZoneId = (status: string, epicId: string | undefined) =>
    `${status}:${epicId ?? "unassigned"}`;

  // Get total task count
  const totalTaskCount = tasks.filter(filterTask).length;

  if (loading) {
    return (
      <div class="min-h-screen bg-base-200 flex items-center justify-center">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div class="min-h-screen bg-base-200">
        {/* Header */}
        <div class="navbar bg-base-100 shadow-lg mb-4">
          <div class="flex-1 flex items-center">
            <button class="btn btn-ghost btn-circle" onClick={() => route("/")}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div class="flex items-center gap-2 px-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <h1 class="text-xl font-bold">{projectName}</h1>
              <span class="text-base-content/50 text-lg ml-1">
                {totalTaskCount} tasks
              </span>
            </div>
          </div>
          <div class="flex gap-2">
            <ThemeToggle />
            <button class="btn btn-primary btn-sm" onClick={() => openNewTask()}>
              New Task
            </button>
            <button class="btn btn-neutral btn-sm" onClick={openNewEpic}>
              New Epic
            </button>
          </div>
        </div>

        <div class="px-6 pb-0">
          {/* Filter Bar */}
          <div class="bg-base-100 rounded-xl p-4 shadow-sm mb-6">
            <div class="flex items-center gap-4">
              <div class="relative flex-1 max-w-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  class="input input-bordered w-full pl-10 text-sm"
                  value={searchQuery}
                  onInput={(e) =>
                    setSearchQuery((e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <select
                class="select select-bordered text-sm font-medium"
                value={filterEpicId}
                onChange={(e) =>
                  setFilterEpicId((e.target as HTMLSelectElement).value)
                }
              >
                <option value="all">All Epics</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.title}
                  </option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
              <select
                class="select select-bordered text-sm font-medium"
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus((e.target as HTMLSelectElement).value)
                }
              >
                <option value="all">All Statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>
              {(searchQuery ||
                filterEpicId !== "all" ||
                filterStatus !== "all") && (
                <button
                  class="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterEpicId("all");
                    setFilterStatus("all");
                  }}
                >
                  Clear
                </button>
              )}
              <div class="flex-1" />
              <button
                class="btn btn-ghost btn-sm"
                onClick={() => setCleanupDialogOpen(true)}
                title="Clean up board"
              >
                Clean Up
              </button>
              {/* View Toggle */}
              <div class="join">
                <button
                  class={`btn btn-sm join-item ${viewMode === "normal" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setViewMode("normal")}
                  title="Normal view"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  class={`btn btn-sm join-item ${viewMode === "condensed" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setViewMode("condensed")}
                  title="Condensed view"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
              {/* Planning Column Toggle */}
              <button
                class={`btn btn-sm ${planningCollapsed ? "btn-ghost" : "btn-ghost"}`}
                onClick={() => setPlanningCollapsed(!planningCollapsed)}
                title={planningCollapsed ? "Show Planning column" : "Hide Planning column"}
              >
                {planningCollapsed ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                      clip-rule="evenodd"
                    />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fill-rule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                )}
                <span class="ml-1 text-xs">Planning</span>
              </button>
            </div>
          </div>
        </div>

        {/* Swimlanes */}
        <div class="px-6 pb-6 space-y-4">
          {/* Epic Swimlanes */}
          {epics
            .filter(
              (epic) => filterEpicId === "all" || filterEpicId === epic.id
            )
            .map((epic) => {
              const isCollapsed = collapsedEpics.has(epic.id);
              const epicColor = getEpicColor(epic.id, epics);
              const taskCount = getEpicTaskCount(epic.id);

              return (
                <div
                  key={epic.id}
                  class="bg-base-100 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Epic Header */}
                  <div
                    class="p-4 flex items-center gap-3 cursor-pointer hover:bg-base-200 transition-colors"
                    onClick={() => toggleEpicCollapse(epic.id)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class={`h-5 w-5 text-base-content/40 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: epicColor }}
                    />
                    <span class="font-semibold">{epic.title}</span>
                    <span class="text-base-content/40 text-sm bg-base-200 px-2 py-0.5 rounded">
                      {taskCount} task{taskCount !== 1 ? "s" : ""}
                    </span>
                    <button
                      class="ml-auto text-base-content/40 hover:text-base-content/60 p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditEpic(epic);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>

                  {/* Epic Content */}
                  {!isCollapsed && (
                    <div class="px-4 pb-4">
                      <div class="flex gap-4">
                        {/* Collapsed Planning Column */}
                        {planningCollapsed && (
                          <div
                            class="w-8 min-h-[100px] bg-base-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-base-300 transition-colors relative"
                            onClick={() => setPlanningCollapsed(false)}
                            title="Show Planning column"
                          >
                            <div class="absolute inset-0 flex items-center justify-center">
                              <span
                                class="text-xs font-medium text-base-content/60 whitespace-nowrap"
                                style={{ transform: "rotate(-90deg)" }}
                              >
                                Planning ({getColumnTasks("planning", epic.id).length})
                              </span>
                            </div>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 text-base-content/40 absolute top-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                                clip-rule="evenodd"
                              />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          </div>
                        )}

                        {/* Main Columns Container */}
                        <div class="flex-1">
                          {/* Column Headers */}
                          <div class={`grid ${planningCollapsed ? "grid-cols-3" : "grid-cols-4"} gap-4 mb-3`}>
                            {STATUSES.filter(s => !planningCollapsed || s !== "planning").map((status) => {
                              const config = STATUS_CONFIG[status];
                              const count = getColumnTasks(status, epic.id).length;
                              return (
                                <div key={status} class="flex items-center gap-2">
                                  <span
                                    class="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: config.color }}
                                  />
                                  <span class="font-medium text-sm">
                                    {config.label}
                                  </span>
                                  <span class="text-base-content/40 text-sm">
                                    {count}
                                  </span>
                                  {status === "planning" && (
                                    <button
                                      class="ml-auto w-5 h-5 rounded flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:bg-base-200 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openNewTask(epic.id);
                                      }}
                                      title="Add task to this epic"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                          clip-rule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Columns */}
                          <div class={`grid ${planningCollapsed ? "grid-cols-3" : "grid-cols-4"} gap-4`}>
                            {STATUSES.filter(s => !planningCollapsed || s !== "planning").map((status) => (
                              <DroppableColumn
                                key={getDropZoneId(status, epic.id)}
                                id={getDropZoneId(status, epic.id)}
                                isEmpty={
                                  getColumnTasks(status, epic.id).length === 0
                                }
                              >
                                {getColumnTasks(status, epic.id).map(
                                  (task, taskIndex) => (
                                    <DraggableTaskCard
                                      key={task.id}
                                      task={task}
                                      epicColor={epicColor}
                                      epicTitle={epic.title}
                                      taskNumber={taskIndex + 1}
                                      onClick={() => openEditTask(task)}
                                      condensed={viewMode === "condensed"}
                                    />
                                  )
                                )}
                              </DroppableColumn>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Unassigned Lane */}
          {(filterEpicId === "all" || filterEpicId === "unassigned") && (
            <div class="bg-base-100 rounded-xl shadow-sm overflow-hidden">
              <div
                class="p-4 flex items-center gap-3 cursor-pointer hover:bg-base-200 transition-colors"
                onClick={() => toggleEpicCollapse("unassigned")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class={`h-5 w-5 text-base-content/40 transition-transform ${
                    collapsedEpics.has("unassigned") ? "" : "rotate-90"
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="w-3 h-3 rounded-full bg-base-content/40 flex-shrink-0" />
                <span class="font-semibold">Unassigned</span>
                <span class="text-base-content/40 text-sm bg-base-200 px-2 py-0.5 rounded">
                  {getEpicTaskCount(undefined)} task
                  {getEpicTaskCount(undefined) !== 1 ? "s" : ""}
                </span>
              </div>

              {!collapsedEpics.has("unassigned") && (
                <div class="px-4 pb-4">
                  <div class="flex gap-4">
                    {/* Collapsed Planning Column */}
                    {planningCollapsed && (
                      <div
                        class="w-8 min-h-[100px] bg-base-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-base-300 transition-colors relative"
                        onClick={() => setPlanningCollapsed(false)}
                        title="Show Planning column"
                      >
                        <div class="absolute inset-0 flex items-center justify-center">
                          <span
                            class="text-xs font-medium text-base-content/60 whitespace-nowrap"
                            style={{ transform: "rotate(-90deg)" }}
                          >
                            Planning ({getColumnTasks("planning", undefined).length})
                          </span>
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 text-base-content/40 absolute top-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                            clip-rule="evenodd"
                          />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      </div>
                    )}

                    {/* Main Columns Container */}
                    <div class="flex-1">
                      <div class={`grid ${planningCollapsed ? "grid-cols-3" : "grid-cols-4"} gap-4 mb-3`}>
                        {STATUSES.filter(s => !planningCollapsed || s !== "planning").map((status) => {
                          const config = STATUS_CONFIG[status];
                          const count = getColumnTasks(status, undefined).length;
                          return (
                            <div key={status} class="flex items-center gap-2">
                              <span
                                class="w-2 h-2 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              <span class="font-medium text-sm">
                                {config.label}
                              </span>
                              <span class="text-base-content/40 text-sm">
                                {count}
                              </span>
                              {status === "planning" && (
                                <button
                                  class="ml-auto w-5 h-5 rounded flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:bg-base-200 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openNewTask(undefined);
                                  }}
                                  title="Add unassigned task"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div class={`grid ${planningCollapsed ? "grid-cols-3" : "grid-cols-4"} gap-4`}>
                        {STATUSES.filter(s => !planningCollapsed || s !== "planning").map((status) => (
                          <DroppableColumn
                            key={getDropZoneId(status, undefined)}
                            id={getDropZoneId(status, undefined)}
                            isEmpty={getColumnTasks(status, undefined).length === 0}
                          >
                            {getColumnTasks(status, undefined).map(
                              (task, taskIndex) => (
                                <DraggableTaskCard
                                  key={task.id}
                                  task={task}
                                  epicColor="#9ca3af"
                                  epicTitle="Unassigned"
                                  taskNumber={taskIndex + 1}
                                  onClick={() => openEditTask(task)}
                                  condensed={viewMode === "condensed"}
                                />
                              )
                            )}
                          </DroppableColumn>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modals */}
        <TaskForm
          isOpen={taskFormOpen}
          onClose={closeTaskForm}
          onSave={refreshData}
          task={editingTask}
          projectId={projectId!}
          defaultEpicId={defaultEpicId}
        />
        <EpicForm
          isOpen={epicFormOpen}
          onClose={closeEpicForm}
          onSave={refreshData}
          epic={editingEpic}
          projectId={projectId!}
        />

        {/* Cleanup Dialog */}
        {cleanupDialogOpen && (
          <div class="modal modal-open">
            <div class="modal-box">
              <h3 class="font-bold text-lg">Clean Up Board</h3>
              <div class="py-4 space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox"
                    checked={cleanupArchiveTasks}
                    onChange={(e) =>
                      setCleanupArchiveTasks((e.target as HTMLInputElement).checked)
                    }
                  />
                  <span>Archive Done Tasks</span>
                  {doneTaskCount > 0 && (
                    <span class="text-base-content/50 text-sm">
                      ({doneTaskCount} task{doneTaskCount !== 1 ? "s" : ""})
                    </span>
                  )}
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox"
                    checked={cleanupArchiveEpics}
                    onChange={(e) =>
                      setCleanupArchiveEpics((e.target as HTMLInputElement).checked)
                    }
                  />
                  <span>Archive Empty Epics</span>
                </label>
              </div>
              <div class="modal-action">
                <button
                  class="btn btn-ghost"
                  onClick={() => {
                    setCleanupDialogOpen(false);
                    setCleanupArchiveTasks(true);
                    setCleanupArchiveEpics(true);
                  }}
                >
                  Cancel
                </button>
                <button
                  class="btn btn-primary"
                  onClick={handleCleanup}
                  disabled={!cleanupArchiveTasks && !cleanupArchiveEpics}
                >
                  Clean
                </button>
              </div>
            </div>
            <div
              class="modal-backdrop bg-black/50"
              onClick={() => {
                setCleanupDialogOpen(false);
                setCleanupArchiveTasks(true);
                setCleanupArchiveEpics(true);
              }}
            />
          </div>
        )}
      </div>
    </DndContext>
  );
}
