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
import { useBoardPreferences } from "../hooks/useBoardPreferences";
import {
  ArrowLeftIcon,
  Bars3BottomLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";

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

  // Modal state
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [epicFormOpen, setEpicFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithBlocked | undefined>(
    undefined
  );
  const [editingEpic, setEditingEpic] = useState<Epic | undefined>(undefined);
  const [defaultEpicId, setDefaultEpicId] = useState<string | undefined>(
    undefined
  );

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEpicId, setFilterEpicId] = useState<string | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string | "all">("all");

  // Cleanup dialog state
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupArchiveTasks, setCleanupArchiveTasks] = useState(true);
  const [cleanupArchiveEpics, setCleanupArchiveEpics] = useState(true);

  // Board preferences (persisted to localStorage)
  const {
    viewMode,
    planningCollapsed,
    collapsedEpics,
    setViewMode,
    setPlanningCollapsed,
    toggleEpicCollapse,
  } = useBoardPreferences(projectId ?? "");

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
      const notesText = Array.isArray(task.notes) ? task.notes.join(" ") : (task.notes || "");
      const matchesNotes = notesText.toLowerCase().includes(query);
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
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div class="flex items-center gap-2 px-2">
              <Squares2X2Icon className="h-6 w-6 text-primary" />
              <h1 class="text-xl font-bold">{projectName}</h1>
              <span class="text-base-content/50 text-lg ml-1">
                {totalTaskCount} tasks
              </span>
            </div>
          </div>
          <div class="flex gap-2">
            <ThemeToggle />
            <button
              class="btn btn-primary btn-sm"
              onClick={() => openNewTask()}
            >
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
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40" />
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
                  class={`btn btn-sm join-item ${
                    viewMode === "normal" ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setViewMode("normal")}
                  title="Normal view"
                >
                  <ViewColumnsIcon className="h-4 w-4" />
                </button>
                <button
                  class={`btn btn-sm join-item ${
                    viewMode === "condensed" ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setViewMode("condensed")}
                  title="Condensed view"
                >
                  <Bars3BottomLeftIcon className="h-4 w-4" />
                </button>
              </div>
              {/* Planning Column Toggle */}
              <button
                class={`btn btn-sm ${
                  planningCollapsed ? "btn-ghost" : "btn-ghost"
                }`}
                onClick={() => setPlanningCollapsed(!planningCollapsed)}
                title={
                  planningCollapsed
                    ? "Show Planning column"
                    : "Hide Planning column"
                }
                >
                  {planningCollapsed ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
                <span class="ml-1 text-xs">Show Planning</span>
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
                    <ChevronRightIcon
                      className={`h-5 w-5 text-base-content/40 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    />
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
                      <PencilSquareIcon className="h-4 w-4" />
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
                                Planning (
                                {getColumnTasks("planning", epic.id).length})
                              </span>
                            </div>
                            <EyeSlashIcon className="h-4 w-4 text-base-content/40 absolute top-2" />
                          </div>
                        )}

                        {/* Main Columns Container */}
                        <div class="flex-1">
                          {/* Column Headers */}
                          <div
                            class={`grid ${
                              planningCollapsed ? "grid-cols-3" : "grid-cols-4"
                            } gap-4 mb-3`}
                          >
                            {STATUSES.filter(
                              (s) => !planningCollapsed || s !== "planning"
                            ).map((status) => {
                              const config = STATUS_CONFIG[status];
                              const count = getColumnTasks(
                                status,
                                epic.id
                              ).length;
                              return (
                                <div
                                  key={status}
                                  class="flex items-center gap-2"
                                >
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
                                      <PlusIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Columns */}
                          <div
                            class={`grid ${
                              planningCollapsed ? "grid-cols-3" : "grid-cols-4"
                            } gap-4`}
                          >
                            {STATUSES.filter(
                              (s) => !planningCollapsed || s !== "planning"
                            ).map((status) => (
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
                <ChevronRightIcon
                  className={`h-5 w-5 text-base-content/40 transition-transform ${
                    collapsedEpics.has("unassigned") ? "" : "rotate-90"
                  }`}
                />
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
                            Planning (
                            {getColumnTasks("planning", undefined).length})
                          </span>
                        </div>
                        <EyeSlashIcon className="h-4 w-4 text-base-content/40 absolute top-2" />
                      </div>
                    )}

                    {/* Main Columns Container */}
                    <div class="flex-1">
                      <div
                        class={`grid ${
                          planningCollapsed ? "grid-cols-3" : "grid-cols-4"
                        } gap-4 mb-3`}
                      >
                        {STATUSES.filter(
                          (s) => !planningCollapsed || s !== "planning"
                        ).map((status) => {
                          const config = STATUS_CONFIG[status];
                          const count = getColumnTasks(
                            status,
                            undefined
                          ).length;
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
                                  <PlusIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div
                        class={`grid ${
                          planningCollapsed ? "grid-cols-3" : "grid-cols-4"
                        } gap-4`}
                      >
                        {STATUSES.filter(
                          (s) => !planningCollapsed || s !== "planning"
                        ).map((status) => (
                          <DroppableColumn
                            key={getDropZoneId(status, undefined)}
                            id={getDropZoneId(status, undefined)}
                            isEmpty={
                              getColumnTasks(status, undefined).length === 0
                            }
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
                      setCleanupArchiveTasks(
                        (e.target as HTMLInputElement).checked
                      )
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
                      setCleanupArchiveEpics(
                        (e.target as HTMLInputElement).checked
                      )
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
