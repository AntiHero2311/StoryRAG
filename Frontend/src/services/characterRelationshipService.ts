import { api } from './api';

export interface CharacterRelationshipDto {
    id: string;
    projectId: string;
    charAId: string;
    charBId: string;
    relationType: string;
    strengthScore: number;
    evidenceChunkIds?: number[] | null;
    createdAt: string;
}

export interface CharacterRelationshipExtractResult {
    candidatesConsidered: number;
    pairsSentToAi: number;
    upserted: number;
    skippedNoEvidence: number;
}

const BASE = (projectId: string) => `/projects/${projectId}/character/relationships`;

export const characterRelationshipService = {
    getAll: (projectId: string) =>
        api.get<CharacterRelationshipDto[]>(BASE(projectId)).then(r => r.data),

    extract: (projectId: string) =>
        api.post<CharacterRelationshipExtractResult>(`${BASE(projectId)}/extract`).then(r => r.data),
};

