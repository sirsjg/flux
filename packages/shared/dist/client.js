/**
 * Flux client - abstracts local store vs HTTP server
 * Used by CLI, MCP, and other consumers
 */
import { getProjects as localGetProjects, getProject as localGetProject, createProject as localCreateProject, updateProject as localUpdateProject, deleteProject as localDeleteProject, getProjectStats as localGetProjectStats, getEpics as localGetEpics, getEpic as localGetEpic, createEpic as localCreateEpic, updateEpic as localUpdateEpic, deleteEpic as localDeleteEpic, getTasks as localGetTasks, getTask as localGetTask, createTask as localCreateTask, updateTask as localUpdateTask, deleteTask as localDeleteTask, isTaskBlocked as localIsTaskBlocked, addTaskComment as localAddTaskComment, deleteTaskComment as localDeleteTaskComment, getReadyTasks as localGetReadyTasks, getStore as localGetStore, replaceStore as localReplaceStore, mergeStore as localMergeStore, getWebhooks as localGetWebhooks, getWebhook as localGetWebhook, createWebhook as localCreateWebhook, updateWebhook as localUpdateWebhook, deleteWebhook as localDeleteWebhook, getWebhookDeliveries as localGetWebhookDeliveries, createBlob as localCreateBlob, getBlob as localGetBlob, getBlobs as localGetBlobs, deleteBlob as localDeleteBlob, PRIORITY_CONFIG, PRIORITIES, } from './index.js';
// Re-export types and constants
export { PRIORITY_CONFIG, PRIORITIES };
// Typed HTTP error for better error discrimination
export class FluxHttpError extends Error {
    status;
    statusText;
    constructor(message, status, statusText) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.name = 'FluxHttpError';
    }
    get isNotFound() {
        return this.status === 404;
    }
    get isUnauthorized() {
        return this.status === 401;
    }
}
// Client state
let serverUrl = null;
let apiKey = null;
export function initClient(server, key) {
    serverUrl = server || null;
    apiKey = key || null;
}
export function isServerMode() {
    return serverUrl !== null;
}
export function getServerUrl() {
    return serverUrl;
}
// HTTP helper
async function http(method, path, body) {
    const url = `${serverUrl}${path}`;
    const headers = {};
    if (body)
        headers['Content-Type'] = 'application/json';
    if (apiKey)
        headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, {
        method,
        headers: Object.keys(headers).length ? headers : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new FluxHttpError(err.error || res.statusText, res.status, res.statusText);
    }
    return res.json();
}
// Projects
export async function getProjects() {
    if (serverUrl) {
        return http('GET', '/api/projects');
    }
    return localGetProjects();
}
export async function getProject(id) {
    if (serverUrl) {
        try {
            return await http('GET', `/api/projects/${id}`);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localGetProject(id);
}
export async function createProject(name, description, visibility) {
    if (serverUrl) {
        return http('POST', '/api/projects', { name, description, visibility });
    }
    return localCreateProject(name, description, visibility);
}
export async function updateProject(id, updates) {
    if (serverUrl) {
        try {
            return await http('PATCH', `/api/projects/${id}`, updates);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localUpdateProject(id, updates);
}
export async function deleteProject(id) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/projects/${id}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    localDeleteProject(id);
    return true;
}
export async function getProjectStats(id) {
    if (serverUrl) {
        const project = await http('GET', `/api/projects/${id}`);
        return project.stats || { total: 0, done: 0 };
    }
    return localGetProjectStats(id);
}
// Epics
export async function getEpics(projectId) {
    if (serverUrl) {
        return http('GET', `/api/projects/${projectId}/epics`);
    }
    return localGetEpics(projectId);
}
export async function getEpic(id) {
    if (serverUrl) {
        try {
            return await http('GET', `/api/epics/${id}`);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localGetEpic(id);
}
export async function createEpic(projectId, title, notes, auto) {
    if (serverUrl) {
        return http('POST', `/api/projects/${projectId}/epics`, { title, notes, auto });
    }
    return localCreateEpic(projectId, title, notes, auto);
}
export async function updateEpic(id, updates) {
    if (serverUrl) {
        try {
            return await http('PATCH', `/api/epics/${id}`, updates);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localUpdateEpic(id, updates);
}
export async function deleteEpic(id) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/epics/${id}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    return localDeleteEpic(id);
}
// Tasks
export async function getTasks(projectId) {
    if (serverUrl) {
        return http('GET', `/api/projects/${projectId}/tasks`);
    }
    return localGetTasks(projectId);
}
export async function getTask(id) {
    if (serverUrl) {
        try {
            return await http('GET', `/api/tasks/${id}`);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localGetTask(id);
}
export async function createTask(projectId, title, epicId, options) {
    if (serverUrl) {
        return http('POST', `/api/projects/${projectId}/tasks`, {
            title,
            epic_id: epicId,
            priority: options?.priority,
            depends_on: options?.depends_on,
            acceptance_criteria: options?.acceptance_criteria,
            guardrails: options?.guardrails,
        });
    }
    return localCreateTask(projectId, title, epicId, options);
}
export async function updateTask(id, updates) {
    if (serverUrl) {
        try {
            return await http('PATCH', `/api/tasks/${id}`, updates);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localUpdateTask(id, updates);
}
export async function deleteTask(id) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/tasks/${id}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    return localDeleteTask(id);
}
export async function isTaskBlocked(id) {
    if (serverUrl) {
        try {
            const task = await http('GET', `/api/tasks/${id}`);
            return task.blocked;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    return localIsTaskBlocked(id);
}
// Comments
export async function addTaskComment(taskId, body, author = 'user', agentName) {
    if (serverUrl) {
        try {
            return await http('POST', `/api/tasks/${taskId}/comments`, {
                body,
                author,
                ...(agentName ? { agent_name: agentName } : {}),
            });
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localAddTaskComment(taskId, body, author, agentName);
}
export async function deleteTaskComment(taskId, commentId) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/tasks/${taskId}/comments/${commentId}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    return localDeleteTaskComment(taskId, commentId);
}
// Ready tasks (unblocked, not done, sorted by priority)
export async function getReadyTasks(projectId) {
    if (serverUrl) {
        const query = projectId ? `?project_id=${projectId}` : '';
        return http('GET', `/api/tasks/ready${query}`);
    }
    return localGetReadyTasks(projectId);
}
// Export all data
export async function exportAll() {
    if (serverUrl) {
        return http('GET', '/api/export');
    }
    return localGetStore();
}
// Import data (replace or merge)
export async function importAll(data, merge = false) {
    if (serverUrl) {
        await http('POST', '/api/import', { data, merge });
        return;
    }
    if (merge) {
        localMergeStore(data);
    }
    else {
        localReplaceStore(data);
    }
}
// Webhooks
export async function getWebhooks() {
    if (serverUrl) {
        return http('GET', '/api/webhooks');
    }
    return localGetWebhooks();
}
export async function getWebhook(id) {
    if (serverUrl) {
        try {
            return await http('GET', `/api/webhooks/${id}`);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localGetWebhook(id);
}
export async function createWebhook(name, url, events, options) {
    if (serverUrl) {
        return http('POST', '/api/webhooks', { name, url, events, ...options });
    }
    return localCreateWebhook(name, url, events, options);
}
export async function updateWebhook(id, updates) {
    if (serverUrl) {
        try {
            return await http('PATCH', `/api/webhooks/${id}`, updates);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localUpdateWebhook(id, updates);
}
export async function deleteWebhook(id) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/webhooks/${id}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    return localDeleteWebhook(id);
}
export async function getWebhookDeliveries(webhookId, limit) {
    if (serverUrl) {
        const query = limit ? `?limit=${limit}` : '';
        return http('GET', `/api/webhooks/${webhookId}/deliveries${query}`);
    }
    return localGetWebhookDeliveries(webhookId, limit);
}
// ============ Blobs ============
export async function uploadBlob(content, filename, mime_type, task_id) {
    if (serverUrl) {
        const formData = new FormData();
        formData.append('file', new File([content], filename, { type: mime_type }));
        if (task_id)
            formData.append('task_id', task_id);
        const url = `${serverUrl}/api/blobs`;
        const headers = {};
        if (apiKey)
            headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(url, { method: 'POST', headers, body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new FluxHttpError(err.error || res.statusText, res.status, res.statusText);
        }
        return res.json();
    }
    // Local mode: use blob storage provider
    const { getBlobStorage } = await import('./blob-storage.js');
    const storage = getBlobStorage();
    if (!storage)
        throw new Error('Blob storage not initialized');
    const { hash, size } = storage.write(content);
    return localCreateBlob(hash, filename, mime_type, size, task_id);
}
export async function downloadBlob(id) {
    if (serverUrl) {
        try {
            const blob = await http('GET', `/api/blobs/${id}`);
            const url = `${serverUrl}/api/blobs/${id}/content`;
            const headers = {};
            if (apiKey)
                headers['Authorization'] = `Bearer ${apiKey}`;
            const res = await fetch(url, { headers });
            if (!res.ok)
                return null;
            const content = Buffer.from(await res.arrayBuffer());
            return { blob, content };
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return null;
            throw e;
        }
    }
    const blobMeta = localGetBlob(id);
    if (!blobMeta)
        return null;
    const { getBlobStorage } = await import('./blob-storage.js');
    const storage = getBlobStorage();
    if (!storage)
        throw new Error('Blob storage not initialized');
    const content = storage.read(blobMeta.hash);
    if (!content)
        return null;
    return { blob: blobMeta, content };
}
export async function getBlobMetadata(id) {
    if (serverUrl) {
        try {
            return await http('GET', `/api/blobs/${id}`);
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return undefined;
            throw e;
        }
    }
    return localGetBlob(id);
}
export async function getClientBlobs(filter) {
    if (serverUrl) {
        const query = filter?.task_id ? `?task_id=${filter.task_id}` : '';
        return http('GET', `/api/blobs${query}`);
    }
    return localGetBlobs(filter);
}
export async function deleteBlobClient(id) {
    if (serverUrl) {
        try {
            await http('DELETE', `/api/blobs/${id}`);
            return true;
        }
        catch (e) {
            if (e instanceof FluxHttpError && e.isNotFound)
                return false;
            throw e;
        }
    }
    // Local mode: remove from storage and metadata
    const blobMeta = localGetBlob(id);
    if (!blobMeta)
        return false;
    const { getBlobStorage } = await import('./blob-storage.js');
    const storage = getBlobStorage();
    if (storage) {
        // Only remove file if no other blob metadata references same hash
        const allBlobs = localGetBlobs();
        const otherRefs = allBlobs.filter(b => b.hash === blobMeta.hash && b.id !== id);
        if (otherRefs.length === 0) {
            storage.remove(blobMeta.hash);
        }
    }
    return localDeleteBlob(id);
}
export async function getAuthStatus() {
    if (!serverUrl) {
        return { authenticated: true, keyType: 'env' };
    }
    return http('GET', '/api/auth/status');
}
export async function getApiKeys() {
    if (!serverUrl) {
        throw new Error('API keys only available in server mode');
    }
    return http('GET', '/api/auth/keys');
}
export async function createApiKeyRemote(name, projectIds) {
    if (!serverUrl) {
        throw new Error('API keys only available in server mode');
    }
    return http('POST', '/api/auth/keys', {
        name,
        project_ids: projectIds,
    });
}
export async function deleteApiKeyRemote(id) {
    if (!serverUrl) {
        throw new Error('API keys only available in server mode');
    }
    try {
        await http('DELETE', `/api/auth/keys/${id}`);
        return true;
    }
    catch (e) {
        if (e instanceof FluxHttpError && e.isNotFound)
            return false;
        throw e;
    }
}
// CLI auth flow
export async function initCliAuth() {
    if (!serverUrl) {
        throw new Error('CLI auth only available in server mode');
    }
    return http('POST', '/api/auth/cli-init', {});
}
export async function pollCliAuth(token) {
    if (!serverUrl) {
        throw new Error('CLI auth only available in server mode');
    }
    return http('POST', '/api/auth/cli-poll', { token });
}
export async function completeCliAuth(token, name, projectIds) {
    if (!serverUrl) {
        throw new Error('CLI auth only available in server mode');
    }
    return http('POST', '/api/auth/cli-complete', {
        token,
        name,
        project_ids: projectIds,
    });
}
