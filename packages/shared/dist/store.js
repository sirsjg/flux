let authFunctions = null;
export function setAuthFunctions(fns) {
    authFunctions = fns;
}
function requireAuth() {
    if (!authFunctions) {
        throw new Error('Auth functions not initialized. Call setAuthFunctions first (server-side only).');
    }
    return authFunctions;
}
let db;
// Generate a short unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}
// Ensure guardrails have IDs (for MCP/API input that may omit them)
function ensureGuardrailIds(guardrails) {
    if (!guardrails)
        return undefined;
    return guardrails.map(g => g.id ? g : { ...g, id: generateId() });
}
// Set the storage adapter (called once at app startup)
export function setStorageAdapter(adapter) {
    db = adapter;
}
// Get current storage adapter
export function getStorageAdapter() {
    return db;
}
// Initialize the store
export function initStore() {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    db.read();
    // Migrate from old single-project structure if needed
    const data = db.data;
    let needsWrite = false;
    if (!Array.isArray(data.projects)) {
        data.projects = [];
        needsWrite = true;
        // Migrate old project if it exists
        if (data.project) {
            const oldProject = data.project;
            data.projects.push(oldProject);
            // Update tasks and epics with project_id
            if (Array.isArray(data.tasks)) {
                data.tasks.forEach((t) => { t.project_id = oldProject.id; });
            }
            if (Array.isArray(data.epics)) {
                data.epics.forEach((e) => { e.project_id = oldProject.id; });
            }
            delete data.project;
        }
    }
    // Ensure arrays exist
    if (!Array.isArray(data.tasks)) {
        data.tasks = [];
        needsWrite = true;
    }
    if (!Array.isArray(data.epics)) {
        data.epics = [];
        needsWrite = true;
    }
    if (!Array.isArray(data.blobs)) {
        data.blobs = [];
        needsWrite = true;
    }
    // Migrate epics: ensure auto field exists
    data.epics.forEach((epic) => {
        if (epic.auto === undefined) {
            epic.auto = false;
            needsWrite = true;
        }
    });
    // Migrate tasks: convert legacy notes to comments
    data.tasks.forEach((t) => {
        // Handle array notes (very old format)
        if (Array.isArray(t.notes)) {
            t.notes = t.notes.join('\n\n');
            needsWrite = true;
        }
        // Convert string notes to a comment
        if (typeof t.notes === 'string' && t.notes.trim()) {
            if (!t.comments)
                t.comments = [];
            t.comments.unshift({
                id: generateId(),
                body: t.notes,
                author: 'user',
                created_at: t.created_at || new Date().toISOString(),
            });
            needsWrite = true;
        }
        // Remove notes field
        if ('notes' in t) {
            delete t.notes;
            needsWrite = true;
        }
    });
    if (needsWrite)
        db.write();
    return db.data;
}
export function resetStore() {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    db.data.projects = [];
    db.data.epics = [];
    db.data.tasks = [];
    db.data.blobs = [];
    const data = db.data;
    data.webhooks = [];
    data.webhook_deliveries = [];
    db.write();
}
export function getStore() {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    return {
        projects: [...(db.data.projects || [])],
        epics: [...(db.data.epics || [])],
        tasks: [...(db.data.tasks || [])],
        blobs: [...(db.data.blobs || [])],
    };
}
// Direct insert functions for sync — preserve original IDs
/**
 * Insert a task directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if a task with the same ID already exists.
 */
export function insertTask(task) {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    if (!task.id || !task.title || !task.project_id) {
        throw new Error('insertTask requires id, title, and project_id');
    }
    if (db.data.tasks.some(t => t.id === task.id)) {
        throw new Error(`Task with id '${task.id}' already exists`);
    }
    db.data.tasks.push(task);
    db.write();
}
/**
 * Insert an epic directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if an epic with the same ID already exists.
 */
export function insertEpic(epic) {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    if (!epic.id || !epic.title || !epic.project_id) {
        throw new Error('insertEpic requires id, title, and project_id');
    }
    if (db.data.epics.some(e => e.id === epic.id)) {
        throw new Error(`Epic with id '${epic.id}' already exists`);
    }
    db.data.epics.push(epic);
    db.write();
}
/**
 * Insert a project directly, preserving its existing ID.
 * Used by sync to replicate entities from remote nodes.
 * Throws if a project with the same ID already exists.
 */
export function insertProject(project) {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    if (!project.id || !project.name) {
        throw new Error('insertProject requires id and name');
    }
    if (db.data.projects.some(p => p.id === project.id)) {
        throw new Error(`Project with id '${project.id}' already exists`);
    }
    db.data.projects.push(project);
    db.write();
}
export function replaceStore(data) {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    db.data.projects = data.projects || [];
    db.data.epics = data.epics || [];
    db.data.tasks = data.tasks || [];
    db.data.blobs = data.blobs || [];
    db.write();
}
export function mergeStore(data) {
    if (!db)
        throw new Error('Storage adapter not set. Call setStorageAdapter first.');
    // Merge by adding items that don't exist (by id)
    const existingProjectIds = new Set(db.data.projects.map(p => p.id));
    const existingEpicIds = new Set(db.data.epics.map(e => e.id));
    const existingTaskIds = new Set(db.data.tasks.map(t => t.id));
    const existingBlobIds = new Set((db.data.blobs || []).map(b => b.id));
    for (const p of data.projects || []) {
        if (!existingProjectIds.has(p.id))
            db.data.projects.push(p);
    }
    for (const e of data.epics || []) {
        if (!existingEpicIds.has(e.id))
            db.data.epics.push(e);
    }
    for (const t of data.tasks || []) {
        if (!existingTaskIds.has(t.id))
            db.data.tasks.push(t);
    }
    if (!db.data.blobs)
        db.data.blobs = [];
    for (const b of data.blobs || []) {
        if (!existingBlobIds.has(b.id))
            db.data.blobs.push(b);
    }
    db.write();
}
// ============ Project Operations ============
export function getProjects() {
    return [...(db.data.projects || [])];
}
export function getProject(id) {
    return (db.data.projects || []).find(p => p.id === id);
}
export function createProject(name, description, visibility) {
    const project = {
        id: generateId(),
        name,
        description,
        visibility,
    };
    if (!db.data.projects)
        db.data.projects = [];
    db.data.projects.push(project);
    db.write();
    return project;
}
export function updateProject(id, updates) {
    const index = db.data.projects.findIndex(p => p.id === id);
    if (index === -1)
        return undefined;
    db.data.projects[index] = { ...db.data.projects[index], ...updates };
    db.write();
    return db.data.projects[index];
}
export function deleteProject(id) {
    const index = db.data.projects.findIndex(p => p.id === id);
    if (index === -1)
        return;
    // Collect task IDs for this project to clean up blobs
    const taskIds = new Set(db.data.tasks.filter(t => t.project_id === id).map(t => t.id));
    db.data.projects.splice(index, 1);
    // Remove all epics and tasks for this project
    db.data.epics = db.data.epics.filter(e => e.project_id !== id);
    db.data.tasks = db.data.tasks.filter(t => t.project_id !== id);
    // Remove blobs associated with deleted tasks
    if (db.data.blobs) {
        db.data.blobs = db.data.blobs.filter(b => !b.task_id || !taskIds.has(b.task_id));
    }
    db.write();
}
export function getProjectStats(projectId) {
    const tasks = db.data.tasks.filter(t => t.project_id === projectId && !t.archived);
    return {
        total: tasks.length,
        done: tasks.filter(t => t.status === 'done').length,
    };
}
// ============ Epic Operations ============
export function getEpics(projectId) {
    return [...db.data.epics.filter(e => e.project_id === projectId)];
}
export function getAllEpics() {
    return [...db.data.epics];
}
export function getEpic(id) {
    return db.data.epics.find(e => e.id === id);
}
export function createEpic(projectId, title, notes = '', auto = false) {
    const epic = {
        id: generateId(),
        title,
        status: 'planning',
        depends_on: [],
        notes,
        auto,
        project_id: projectId,
    };
    db.data.epics.push(epic);
    db.write();
    return epic;
}
export function updateEpic(id, updates) {
    const index = db.data.epics.findIndex(e => e.id === id);
    if (index === -1)
        return undefined;
    db.data.epics[index] = { ...db.data.epics[index], ...updates };
    db.write();
    return db.data.epics[index];
}
export function deleteEpic(id) {
    const index = db.data.epics.findIndex(e => e.id === id);
    if (index === -1)
        return false;
    db.data.epics.splice(index, 1);
    // Remove epic_id from tasks that belonged to this epic
    db.data.tasks.forEach(task => {
        if (task.epic_id === id) {
            task.epic_id = undefined;
        }
    });
    db.write();
    return true;
}
// ============ Task Operations ============
export function getTasks(projectId) {
    return [...db.data.tasks.filter(t => t.project_id === projectId && !t.archived)];
}
export function getAllTasks() {
    return [...db.data.tasks];
}
export function getTask(id) {
    return db.data.tasks.find(t => t.id === id);
}
export function getTasksByEpic(projectId, epicId) {
    return db.data.tasks.filter(t => t.project_id === projectId && t.epic_id === epicId);
}
export function getTasksByStatus(projectId, status) {
    return db.data.tasks.filter(t => t.project_id === projectId && t.status === status);
}
export function createTask(projectId, title, epicId, options) {
    const now = new Date().toISOString();
    const id = generateId();
    // Validate dependencies exist (can't have cycles for new task, but deps should exist)
    const depends_on = options?.depends_on ?? [];
    for (const depId of depends_on) {
        if (!db.data.tasks.find(t => t.id === depId)) {
            throw new Error(`Dependency not found: ${depId}`);
        }
    }
    const task = {
        id,
        title,
        status: 'planning',
        depends_on,
        comments: [],
        epic_id: epicId,
        project_id: projectId,
        priority: options?.priority,
        acceptance_criteria: options?.acceptance_criteria,
        guardrails: ensureGuardrailIds(options?.guardrails),
        created_at: now,
        updated_at: now,
    };
    db.data.tasks.push(task);
    db.write();
    return task;
}
export function updateTask(id, updates) {
    const index = db.data.tasks.findIndex(t => t.id === id);
    if (index === -1)
        return undefined;
    // Validate dependencies
    if (updates.depends_on) {
        for (const depId of updates.depends_on) {
            if (!db.data.tasks.find(t => t.id === depId)) {
                throw new Error(`Dependency not found: ${depId}`);
            }
        }
        if (wouldCreateCycle(id, updates.depends_on)) {
            throw new Error('Circular dependency detected');
        }
    }
    const processedUpdates = {
        ...updates,
        guardrails: updates.guardrails !== undefined ? ensureGuardrailIds(updates.guardrails) : undefined,
    };
    db.data.tasks[index] = {
        ...db.data.tasks[index],
        ...processedUpdates,
        updated_at: new Date().toISOString(),
    };
    db.write();
    return db.data.tasks[index];
}
export function deleteTask(id) {
    const index = db.data.tasks.findIndex(t => t.id === id);
    if (index === -1)
        return false;
    // Clean up associated blobs
    if (db.data.blobs) {
        db.data.blobs = db.data.blobs.filter(b => b.task_id !== id);
    }
    db.data.tasks.splice(index, 1);
    // Remove this task from any depends_on arrays
    db.data.tasks.forEach(task => {
        const depIndex = task.depends_on.indexOf(id);
        if (depIndex !== -1) {
            task.depends_on.splice(depIndex, 1);
        }
    });
    db.write();
    return true;
}
// ============ Comment Operations ============
export function addTaskComment(taskId, body, author, agentName) {
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task)
        return undefined;
    const comment = {
        id: generateId(),
        body,
        author,
        ...(agentName ? { agent_name: agentName } : {}),
        created_at: new Date().toISOString(),
    };
    if (!task.comments)
        task.comments = [];
    task.comments.push(comment);
    db.write();
    return comment;
}
export function deleteTaskComment(taskId, commentId) {
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task?.comments)
        return false;
    const index = task.comments.findIndex(comment => comment.id === commentId);
    if (index === -1)
        return false;
    task.comments.splice(index, 1);
    db.write();
    return true;
}
// ============ Dependency Operations ============
// Check if adding dependencies would create a cycle
export function wouldCreateCycle(taskId, newDeps) {
    const visited = new Set();
    const checkCycle = (id) => {
        if (id === taskId)
            return true;
        if (visited.has(id))
            return false;
        visited.add(id);
        const task = db.data.tasks.find(t => t.id === id);
        if (!task)
            return false;
        return task.depends_on.some(depId => checkCycle(depId));
    };
    return newDeps.some(depId => checkCycle(depId));
}
export function addDependency(taskId, dependsOnId) {
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task)
        return false;
    if (!db.data.tasks.find(t => t.id === dependsOnId))
        return false;
    if (task.depends_on.includes(dependsOnId))
        return true;
    if (wouldCreateCycle(taskId, [dependsOnId]))
        return false;
    task.depends_on.push(dependsOnId);
    db.write();
    return true;
}
export function removeDependency(taskId, dependsOnId) {
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task)
        return false;
    const index = task.depends_on.indexOf(dependsOnId);
    if (index === -1)
        return false;
    task.depends_on.splice(index, 1);
    db.write();
    return true;
}
export function isTaskBlocked(taskId) {
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!task)
        return false;
    // External blocker takes precedence
    if (task.blocked_reason)
        return true;
    // Dependency-based blocking
    if (task.depends_on.length === 0)
        return false;
    return task.depends_on.some(depId => {
        const dep = db.data.tasks.find(t => t.id === depId);
        return dep && dep.status !== 'done';
    });
}
// Get ready tasks: unblocked, not done, not archived, sorted by priority
export function getReadyTasks(projectId) {
    let tasks = db.data.tasks.filter(t => !t.archived && t.status !== 'done');
    if (projectId) {
        tasks = tasks.filter(t => t.project_id === projectId);
    }
    // Filter out blocked tasks
    tasks = tasks.filter(t => !isTaskBlocked(t.id));
    // Sort by priority (P0 first, then P1, then P2, then undefined)
    tasks.sort((a, b) => {
        const pa = a.priority ?? 2;
        const pb = b.priority ?? 2;
        return pa - pb;
    });
    return tasks;
}
// ============ Archive Operations ============
export function archiveDoneTasks(projectId) {
    let count = 0;
    db.data.tasks.forEach(task => {
        if (task.project_id === projectId && task.status === 'done' && !task.archived) {
            task.archived = true;
            count++;
        }
    });
    if (count > 0) {
        db.write();
    }
    return count;
}
export function archiveEmptyEpics(projectId) {
    let count = 0;
    const epicIdsToDelete = [];
    db.data.epics.forEach(epic => {
        if (epic.project_id === projectId) {
            // Check if epic has any non-archived tasks
            const hasActiveTasks = db.data.tasks.some(task => task.epic_id === epic.id && !task.archived);
            if (!hasActiveTasks) {
                epicIdsToDelete.push(epic.id);
                count++;
            }
        }
    });
    if (epicIdsToDelete.length > 0) {
        db.data.epics = db.data.epics.filter(e => !epicIdsToDelete.includes(e.id));
        db.write();
    }
    return count;
}
export function cleanupProject(projectId, archiveTasks, archiveEpics) {
    let archivedTasks = 0;
    let deletedEpics = 0;
    if (archiveTasks) {
        archivedTasks = archiveDoneTasks(projectId);
    }
    if (archiveEpics) {
        deletedEpics = archiveEmptyEpics(projectId);
    }
    return { archivedTasks, deletedEpics };
}
// ============ Blob Operations ============
function ensureBlobsArray() {
    if (!db.data.blobs)
        db.data.blobs = [];
}
export function createBlob(hash, filename, mime_type, size, task_id) {
    ensureBlobsArray();
    const blob = {
        id: generateId(),
        hash,
        filename,
        mime_type,
        size,
        task_id,
        created_at: new Date().toISOString(),
    };
    db.data.blobs.push(blob);
    // Add to task's blob_ids if associated
    if (task_id) {
        const task = db.data.tasks.find(t => t.id === task_id);
        if (task) {
            if (!task.blob_ids)
                task.blob_ids = [];
            task.blob_ids.push(blob.id);
        }
    }
    db.write();
    return blob;
}
export function getBlob(id) {
    ensureBlobsArray();
    return db.data.blobs.find(b => b.id === id);
}
export function getBlobByHash(hash) {
    ensureBlobsArray();
    return db.data.blobs.find(b => b.hash === hash);
}
export function getBlobs(filter) {
    ensureBlobsArray();
    let blobs = [...db.data.blobs];
    if (filter?.task_id) {
        blobs = blobs.filter(b => b.task_id === filter.task_id);
    }
    return blobs;
}
export function deleteBlob(id) {
    ensureBlobsArray();
    const index = db.data.blobs.findIndex(b => b.id === id);
    if (index === -1)
        return false;
    const blob = db.data.blobs[index];
    // Remove from task's blob_ids
    if (blob.task_id) {
        const task = db.data.tasks.find(t => t.id === blob.task_id);
        if (task?.blob_ids) {
            const blobIndex = task.blob_ids.indexOf(id);
            if (blobIndex !== -1)
                task.blob_ids.splice(blobIndex, 1);
        }
    }
    db.data.blobs.splice(index, 1);
    db.write();
    return true;
}
export function attachBlobToTask(blobId, taskId) {
    ensureBlobsArray();
    const blob = db.data.blobs.find(b => b.id === blobId);
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!blob || !task)
        return false;
    blob.task_id = taskId;
    if (!task.blob_ids)
        task.blob_ids = [];
    if (!task.blob_ids.includes(blobId)) {
        task.blob_ids.push(blobId);
    }
    db.write();
    return true;
}
export function detachBlobFromTask(blobId, taskId) {
    ensureBlobsArray();
    const blob = db.data.blobs.find(b => b.id === blobId);
    const task = db.data.tasks.find(t => t.id === taskId);
    if (!blob || !task)
        return false;
    if (blob.task_id === taskId) {
        blob.task_id = undefined;
    }
    if (task.blob_ids) {
        const index = task.blob_ids.indexOf(blobId);
        if (index !== -1)
            task.blob_ids.splice(index, 1);
    }
    db.write();
    return true;
}
// ============ Webhook Operations ============
// Get typed data accessor
function getWebhookData() {
    return db.data;
}
// Ensure webhooks arrays exist
function ensureWebhooksArrays() {
    const data = getWebhookData();
    if (!data.webhooks)
        data.webhooks = [];
    if (!data.webhook_deliveries)
        data.webhook_deliveries = [];
}
export function getWebhooks() {
    ensureWebhooksArrays();
    return [...(getWebhookData().webhooks || [])];
}
export function getWebhook(id) {
    ensureWebhooksArrays();
    return getWebhookData().webhooks?.find(w => w.id === id);
}
export function getWebhooksByProject(projectId) {
    ensureWebhooksArrays();
    return (getWebhookData().webhooks || []).filter(w => !w.project_id || w.project_id === projectId);
}
export function createWebhook(name, url, events, options) {
    ensureWebhooksArrays();
    const now = new Date().toISOString();
    const webhook = {
        id: generateId(),
        name,
        url,
        events,
        enabled: options?.enabled ?? true,
        secret: options?.secret,
        project_id: options?.project_id,
        created_at: now,
        updated_at: now,
    };
    getWebhookData().webhooks.push(webhook);
    db.write();
    return webhook;
}
export function updateWebhook(id, updates) {
    ensureWebhooksArrays();
    const webhooks = getWebhookData().webhooks;
    const index = webhooks.findIndex(w => w.id === id);
    if (index === -1)
        return undefined;
    webhooks[index] = {
        ...webhooks[index],
        ...updates,
        updated_at: new Date().toISOString(),
    };
    db.write();
    return webhooks[index];
}
export function deleteWebhook(id) {
    ensureWebhooksArrays();
    const data = getWebhookData();
    const index = data.webhooks.findIndex(w => w.id === id);
    if (index === -1)
        return false;
    data.webhooks.splice(index, 1);
    // Also remove any delivery records for this webhook
    data.webhook_deliveries = data.webhook_deliveries.filter(d => d.webhook_id !== id);
    db.write();
    return true;
}
export function testWebhook(id) {
    return getWebhook(id);
}
// ============ Webhook Delivery Operations ============
export function getWebhookDeliveries(webhookId, limit = 50) {
    ensureWebhooksArrays();
    let deliveries = [...(getWebhookData().webhook_deliveries || [])];
    if (webhookId) {
        deliveries = deliveries.filter(d => d.webhook_id === webhookId);
    }
    // Sort by created_at descending (most recent first)
    deliveries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return deliveries.slice(0, limit);
}
export function createWebhookDelivery(webhookId, event, payload) {
    ensureWebhooksArrays();
    const delivery = {
        id: generateId(),
        webhook_id: webhookId,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
    };
    getWebhookData().webhook_deliveries.push(delivery);
    db.write();
    return delivery;
}
export function updateWebhookDelivery(id, updates) {
    ensureWebhooksArrays();
    const deliveries = getWebhookData().webhook_deliveries;
    const index = deliveries.findIndex(d => d.id === id);
    if (index === -1)
        return undefined;
    deliveries[index] = { ...deliveries[index], ...updates };
    db.write();
    return deliveries[index];
}
export function cleanupOldDeliveries(maxAge = 7 * 24 * 60 * 60 * 1000) {
    ensureWebhooksArrays();
    const data = getWebhookData();
    const cutoff = new Date(Date.now() - maxAge).toISOString();
    const originalCount = data.webhook_deliveries.length;
    data.webhook_deliveries = data.webhook_deliveries.filter(d => d.created_at > cutoff);
    const removed = originalCount - data.webhook_deliveries.length;
    if (removed > 0) {
        db.write();
    }
    return removed;
}
// Global webhook event handler (set by server)
let webhookEventHandler = null;
export function setWebhookEventHandler(handler) {
    webhookEventHandler = handler;
}
export function getWebhookEventHandler() {
    return webhookEventHandler;
}
// Trigger webhooks for an event
export async function triggerWebhooks(event, data, projectId) {
    if (!webhookEventHandler)
        return;
    ensureWebhooksArrays();
    const webhooks = getWebhookData().webhooks || [];
    // Find matching webhooks
    const matchingWebhooks = webhooks.filter(w => {
        if (!w.enabled)
            return false;
        if (!w.events.includes(event))
            return false;
        if (w.project_id && projectId && w.project_id !== projectId)
            return false;
        return true;
    });
    // Trigger each webhook
    for (const webhook of matchingWebhooks) {
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            webhook_id: webhook.id,
            data,
        };
        try {
            await webhookEventHandler(event, payload, webhook);
        }
        catch (error) {
            console.error(`Failed to trigger webhook ${webhook.id}:`, error);
        }
    }
}
// ============ API Key Operations ============
function ensureApiKeysArrays() {
    const data = getWebhookData();
    if (!data.api_keys)
        data.api_keys = [];
    if (!data.cli_auth_requests)
        data.cli_auth_requests = [];
}
export function getApiKeys() {
    ensureApiKeysArrays();
    return [...(getWebhookData().api_keys || [])];
}
export function getApiKey(id) {
    ensureApiKeysArrays();
    return getWebhookData().api_keys?.find(k => k.id === id);
}
/**
 * Create a new API key
 * Returns the raw key (shown once to user) and the stored key record
 */
export function createApiKey(name, scope) {
    ensureApiKeysArrays();
    const { key, prefix, hash } = requireAuth().generateKey();
    const apiKey = {
        id: generateId(),
        prefix,
        hash,
        name,
        scope,
        created_at: new Date().toISOString(),
    };
    getWebhookData().api_keys.push(apiKey);
    db.write();
    return { rawKey: key, apiKey };
}
export function deleteApiKey(id) {
    ensureApiKeysArrays();
    const data = getWebhookData();
    const index = data.api_keys.findIndex(k => k.id === id);
    if (index === -1)
        return false;
    data.api_keys.splice(index, 1);
    db.write();
    return true;
}
const LAST_USED_UPDATE_INTERVAL_MS = 60000; // Update last_used_at at most once per minute
/**
 * Validate an API key and return the key record if valid
 * Also updates last_used_at timestamp (throttled to once per minute)
 */
export function validateApiKey(rawKey) {
    ensureApiKeysArrays();
    const { validateKey } = requireAuth();
    const keys = getWebhookData().api_keys || [];
    for (const key of keys) {
        if (validateKey(rawKey, key.hash)) {
            // Throttle last_used_at updates to reduce disk I/O
            const now = Date.now();
            const lastUsed = key.last_used_at ? new Date(key.last_used_at).getTime() : 0;
            if (now - lastUsed > LAST_USED_UPDATE_INTERVAL_MS) {
                key.last_used_at = new Date().toISOString();
                db.write();
            }
            return key;
        }
    }
    return undefined;
}
/**
 * Check if any API keys are configured
 */
export function hasApiKeys() {
    ensureApiKeysArrays();
    return (getWebhookData().api_keys?.length || 0) > 0;
}
// ============ CLI Auth Request Operations ============
const CLI_AUTH_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export function createCliAuthRequest() {
    ensureApiKeysArrays();
    const request = {
        token: requireAuth().generateTempToken(),
        expires_at: new Date(Date.now() + CLI_AUTH_EXPIRY_MS).toISOString(),
    };
    getWebhookData().cli_auth_requests.push(request);
    db.write();
    return request;
}
export function getCliAuthRequest(token) {
    ensureApiKeysArrays();
    const requests = getWebhookData().cli_auth_requests || [];
    return requests.find(r => r.token === token);
}
export function completeCliAuthRequest(token, name, scope) {
    ensureApiKeysArrays();
    const data = getWebhookData();
    const request = data.cli_auth_requests?.find(r => r.token === token);
    if (!request)
        return undefined;
    if (new Date(request.expires_at) < new Date())
        return undefined;
    if (request.completed_at)
        return undefined;
    const { rawKey, apiKey } = createApiKey(name, scope);
    request.name = name;
    request.scope = scope;
    // Encrypt the key with the temp token so it's not stored in plaintext
    request.api_key = requireAuth().encrypt(rawKey, token);
    request.completed_at = new Date().toISOString();
    db.write();
    return { rawKey, apiKey };
}
export function pollCliAuthRequest(token) {
    ensureApiKeysArrays();
    const request = getCliAuthRequest(token);
    if (!request)
        return { status: 'expired' };
    if (new Date(request.expires_at) < new Date())
        return { status: 'expired' };
    if (request.completed_at && request.api_key) {
        // Decrypt the key using the temp token
        const apiKey = requireAuth().decrypt(request.api_key, token);
        if (!apiKey)
            return { status: 'expired' }; // Decrypt failed
        return { status: 'completed', apiKey };
    }
    return { status: 'pending' };
}
export function cleanupExpiredAuthRequests() {
    ensureApiKeysArrays();
    const data = getWebhookData();
    const now = new Date();
    const cutoff = new Date(now.getTime() - CLI_AUTH_EXPIRY_MS * 2); // Keep completed for 2x expiry
    const original = data.cli_auth_requests?.length || 0;
    data.cli_auth_requests = data.cli_auth_requests?.filter(r => {
        if (r.completed_at) {
            return new Date(r.completed_at) > cutoff;
        }
        return new Date(r.expires_at) > now;
    });
    const removed = original - (data.cli_auth_requests?.length || 0);
    if (removed > 0)
        db.write();
    return removed;
}
