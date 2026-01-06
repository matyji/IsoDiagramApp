import { DiagramData } from '../diagramUtils';

export interface SavedDiagram {
    id: string;
    name: string;
    data: DiagramData;
    createdAt: string;
    updatedAt: string;
}

export type StorageType = 'local' | 'server';
