export type AIStatus = 'Idle' | 'Running' | 'Blocked' | 'Failing';
export type RiskLevel = 'Green' | 'Amber' | 'Red';
export type ProjectPhase = 'Shaping' | 'Betting' | 'Active' | 'Shipped';

export interface ProjectMeta {
    aiStatus: AIStatus;
    risk: RiskLevel;
    primaryPhase: ProjectPhase;
    lanes: {
        shaping: number;
        betting: number;
        active: number;
        shipped: number;
    };
    activeBets: number;
    lastEvent: string;
    thrash: {
        cuts: number;
        retries: number;
    };
    blockers: {
        count: number;
        reason?: string;
    };
}

// Importing ProjectWithStats from stores/api to extend it
import { ProjectWithStats } from './stores';

export interface ProjectWithMeta extends ProjectWithStats {
    meta: ProjectMeta;
}
